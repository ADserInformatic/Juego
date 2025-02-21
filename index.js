const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const app = express();
const bodyParser = require('body-parser');
const user = require('./rutas/user');
const sala = require('./rutas/sala');
const carta = require('./rutas/cartas')
const userM = require('./modelos/user');
const salaM = require('./modelos/sala');
const cartaM = require('./modelos/carta')
const adminA = require('./modelos/admin')
const mongoose = require('mongoose');
const cors = require('cors');
app.use(cors())
// Conexión a Base de datos
const porcentajePremio = 0.85
mongoose.connect(process.env.uri, {
  useUnifiedTopology: true,
  useNewUrlParser: true
})
  .then(() => console.log('Base de datos conectada'))
  .catch(e => console.log('error db:', e))

app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.raw());

const server = app.listen(process.env.PORT || 3006, () => {
  console.log('Server is running on port 3006');
});

//Conexión con socketIo, cambiar el localhos por el dominio del front.
const socketIo = require('socket.io');
const admin = require('./modelos/admin');
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:8100']
  }
});

//Rutas
app.use('/', user)
app.use('/sala', sala)
app.use('/carta', carta)
//Wwbsocket
//En qué momento se hace la conexión lo manejo desde el front
io.on('connection', (socket) => {
  socket.on('sala', async (id) => {
    const sala = await salaM.findOne({ _id: id })
    try {
      socket.join(sala.name)
      //Lo que está entre parentesis limita los usuarios a los que emito. En este los usuarios que esten en la sala con el mismo nombre.
      //La diferencia entre io.to y socket.to es que, en el primer caso se emite para todos los usuarios que están dentro de la sala. En el siguiente caso se obvia a quien hizo la petición al back
      io.to(sala.name).emit('sala', sala)
      if (sala.usuarios[0].valores.length == 0 && sala.usuarios[1].valores.length == 0) { await repartir(sala) }
    }
    catch {
      console.log("no existe la sala")
    }
  })

  //Con socket.io se utiliza emit para emitir una acción y on para escuchar esa acción, lo que debe coinsidir es el nombre que va entre comillas
  //Se escucha la acción 'repartir' y se ejecuta la siguiente función
  socket.on('repartir', async (_sala) => {
    //Se recibe la sala para la que hay que repartir y se busca en la base de datos
    const salaOn = await salaM.findOne({ _id: _sala._id })
    await repartir(_sala)
    //vuelve a false los booleanos de cantos

    const salaActualizada = await salaM.findOne({ _id: salaOn._id })
    io.to(salaOn.name).emit('repartir', salaActualizada)
  })

  //Cada vez que un usuario tira (presiona) una carta, se ejecuta esta acción
  socket.on('tirar', async (jugada) => {
    //LLega un objeto con los datos de la jugada (sala, id del usuario y valor jugado)
    //Se busca la sala en la que se está jugando a partir del nombre
    const salaOn = await salaM.findOne({ name: jugada.sala })
    //Se guarda los usuarios que están jugando en esa sala en un array
    let users = salaOn.usuarios
    users.forEach(async (element) => {
      //Recorro los usuarios en esa sala y al que coincide con el id del que hizo la jugada se le actualizan los datos
      if (jugada.idUser === element.id.toHexString()) {
        //Esto lo que hace es filtrar todas la cartas que no coinciden con la que tiró, ya que son las que le quedan
        element.valores = element.valores.filter(e => e.name != jugada.carta)
        //Agregamos la nueva jugada al usuario en cuestión
        let existe = element.jugada.find(e => e.carta === jugada.carta)
        if (!existe) {
          element.jugada.push(jugada) //si no existe la jugada, la agrega
          element.puedeFlor = false;//al tirar una carta ya no puede cantar flor
          element.puedeMentir = false;//al tirar una carta ya no puede mentir
        }
      }

    })
    //Una vez que se actualiza la jugada al usuario que la realizá, se compara los valores. La función compararValores compara las últimas jugadas de los jugadores y actualiza el puntaje dependiendo del resultado de la comparación.
    let terminoMano = await compararValores(salaOn) //dentro de comparar valores comprueba en q tiro estan y suma puntos, indica si termino la mano con true o false
    console.log("termino la Mano? ", terminoMano)

    //Una vez actualizado el usuario se actualiza la sala
    await salaM.findByIdAndUpdate({ _id: salaOn._id }, { $set: { usuarios: users, partida: salaOn.partida } })
    //Una vez actualizada la sala se vuelve a buscar para devolverla al front (el update no devuelve el objeto actualizado, por eso este paso extra)
    const salaActualizada = await salaM.findOne({ _id: salaOn._id })
    //Una vez hecho todo esto se emite hacia el front la sala con los nuevos datos
    io.to(salaOn.name).emit('muestra', salaActualizada) //muestra la ultima carta tirada,

    //La función terminar determina si una partida entre dos jugadores ha terminado basándose en el número de jugadas realizadas y declara al ganador
    if (terminoMano) { //si terminó la mano
      /*       salaOn.finish = true; //ya deberia estar igual en true xq lo hace dentro de comparar valores o al no querer los rabones
            salaOn.save() */
      //SI TERMINO LA MANO PREGUNTO SI TERMINO EL JUEGO
      let terminoJuego = await terminar(salaOn) //vuelve a repartir y suma partidas pero si ya termino el juego devuelve true o false
      if (!terminoJuego) { //si el resultado de la funcion terminar es falso, se sigue el juego y se reparte, solo termino una mano
        setTimeout(() => {
          repartir(salaActualizada)
          console.log("repartido")
        }, 5000); //reparte a los 5 segundos
      } else {

        try {
          const admin = await adminA.findOne({})
          let winner;
          if (users[0].tantos > users[1].tantos) {
            winner = await userM.findOne({ _id: users[0].id })
          } else {
            winner = await userM.findOne({ _id: users[1].id })
          }
          if (winner) { // le sumo el premio de la apuesta al jugador si ya ganó
            console.log("ganador: ", winner.name)
            let creditosFinales = winner.credito + (2 * sala.apuesta * porcentajePremio)
            const admin = await adminA.findOne({})
            admin.earning += (2 * sala.apuesta * (1 - porcentajePremio))
            admin.save()
            winner.credito = creditosFinales;
            console.log("creditos ganados: ", (2 * sala.apuesta * porcentajePremio))
            winner.save()
            console.log("partida terminada correctamente")

            //ahora destruyo sala y emito a ambos el cartel de juego terminado y al aceptar los mandamos al lobby
            let mensaje = `El juego ha terminado...`
            let data = { mensaje, sala }
            io.to(res.sala).emit('resultadoDeCanto', data)

            await salaM.findOneAndDelete({ name: res.sala })
            salaM.save()

          } else { console.log("NO SE ENCUENTRA EL ID GANADOR EN LA SALA") }





          //aca tengo q ver q hago si ya termino ************************************************************************
        } catch (err) {
          console.log("error en destruir sala, el error es : ", err)
        }
      }
    }

  })

  //Cuando un jugador canta (envido, flor o truco), se emite al otro jugador el canto y, en caso de requerirse, se espera una respuesta.
  socket.on('canto', async (res) => {
    let ores = await booleanos(res);
    // console.log("dentro de canto: ", res.sala)
    const sala = await salaM.findOne({ name: res.sala });

    if (res.canto == 'envido' || res.canto == 'reenvido' || res.canto == 'realEnvido' || res.canto == 'faltaEnvido' || res.canto == 'flor') {
      sala.cantosenmano.boolTruco = false;
      sala.save()
    }
    socket.to(res.sala).emit('cantando', ores)
  })

  //Esto está recibiendo tanto envido como truco y flor. ¡Tener eso en cuenta!
  socket.on('respuestaCanto', async (res) => {
    const sala = await salaM.findOne({ name: res.sala })
    const users = sala.usuarios
    let datos;
    let mensaje;
    let canto = res.canto
    res = await booleanos(res);
    //
    switch (canto) {
      case 'envido':
        switch (res.respuesta) {
          case 'quiero':
            //Acá paso los usuarios a la función que calcula los puntos
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 2
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 2
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              let jf = await juegoFinalizado(res.sala)
              console.log("juego finalizado?: ", jf)
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                users[1].tantos += 2;
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                users[0].tantos += 2;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              datos = {
                mensaje,
                res
              }
              let jf = await juegoFinalizado(res.sala)
              console.log("juego finalizado?: ", jf)
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
          case 'noquiero':
            var me;
            users.forEach(us => {
              if (us.name === res.jugador.name) {
                us.tantos += 1
              } else {
                me = `${us.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje: me,
              sala
            }
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
          default:

            res.canto = res.respuesta;
            res = await booleanos(res);
            // console.log(res)
            socket.to(res.sala).emit('cantando', res)
            break;
        }
        break;
      case 'reEnvido':
        switch (res.respuesta) {
          case 'quiero':
            // const sala = await salaM.findOne({ name: res.sala })
            // const users = sala.usuarios
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 4
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 4
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              let jf = await juegoFinalizado(res.sala)
              console.log("juego finalizado?: ", jf)
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                users[1].tantos += 4;
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                users[0].tantos += 4;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              datos = {
                mensaje,
                res
              }
              let jf = await juegoFinalizado(res.sala)
              console.log("juego finalizado?: ", jf)
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
          case 'noquiero':
            var me;
            users.forEach(us => {
              if (us.name === res.jugador.name) {
                us.tantos += 2
              } else {
                me = `${us.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje: me,
              sala
            }
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
          default:
            res.canto = res.respuesta;
            res = await booleanos(res);
            socket.to(res.sala).emit('cantando', res)
            break;
        }
        break;
      case 'realEnvido':
        switch (res.respuesta) {
          case 'quiero':
            // const sala = await salaM.findOne({ name: res.sala })
            // const users = sala.usuarios
            if (users[0].puntosMentira > users[1].puntosMentira) {
              // console.log(sala.cantosenmano)
              if (sala.cantosenmano.boolReEnvido) { users[0].tantos += 7 } //se cantó envido envido realenvido
              else {
                if (sala.cantosenmano.boolEnvido) { users[0].tantos += 5 } //se canto envido realenvido
                else {
                  users[0].tantos += 3
                } //solo se cantó real envido
              }
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              let jf = await juegoFinalizado(res.sala)
              console.log("juego finalizado?: ", jf)
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              if (sala.cantosenmano.boolReEnvido) { users[1].tantos += 7 } //se cantó envido envido realenvido
              else {
                if (sala.cantosenmano.boolEnvido) { users[1].tantos += 5 } //se canto envido realenvido
                else {
                  users[1].tantos += 3
                }
              }//solo se cantó real envido}
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              let jf = await juegoFinalizado(res.sala)
              console.log("juego finalizado?: ", jf)
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', datos)

            break;
          case 'noquiero':
            var me;
            users.forEach(us => {
              if (us.name === res.jugador.name) {
                if (sala.cantosenmano.boolReEnvido) { us.tantos += 4 } //se cantó envido envido realenvido
                else {
                  if (sala.cantosenmano.boolEnvido) { us.tantos += 2 } //se canto envido realenvido
                  else { us.tantos += 1 }
                }//solo se cantó real envido
              } else {
                me = `${us.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje: me,
              sala
            }
            let jjf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jjf)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
          default:
            res.canto = res.respuesta;
            res = await booleanos(res);
            socket.to(res.sala).emit('cantando', res)
            break;
        }
        break;
      case 'faltaEnvido':
        switch (res.respuesta) {
          case 'quiero':
            if (users[0].puntosMentira > users[1].puntosMentira) {
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              if (sala.unaFalta) {
                users[0].tantos += 30 - users[1].tantos;
              } else {
                if (user[1].tantos < 15) { users[0].tantos += 15 - users[1].tantos; }
                else { { users[0].tantos += 30 - users[1].tantos; } }
              }

            } else {
              if (users[1].puntosMentira > users[0].puntosMentira) {
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                if (sala.unaFalta) {
                  users[1].tantos += 30 - users[0].tantos;
                } else {
                  if (user[0].tantos < 15) { users[1].tantos += 15 - users[0].tantos; }
                  else { { users[1].tantos += 30 - users[0].tantos; } }
                }
              }
              else {
                if (users[0].puntosMentira == users[1].puntosMentira) {
                  if (users[0].mano) {
                    mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos POR MANO`
                    if (sala.unaFalta) {
                      users[0].tantos += 30 - users[1].tantos;
                    } else {
                      if (user[1].tantos < 15) { users[0].tantos += 15 - users[1].tantos; }
                      else { { users[0].tantos += 30 - users[1].tantos; } }
                    }
                  } else {
                    mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos POR MANO`
                    if (sala.unaFalta) {
                      users[1].tantos += 30 - users[0].tantos;
                    } else {
                      if (user[0].tantos < 15) { users[1].tantos += 15 - users[0].tantos; }
                      else { { users[1].tantos += 30 - users[0].tantos; } }
                    }
                  }
                }

              }
            }
            //***********************************************************************LLAMAR A FUNCION PARA FINALIZAR PARTIDA
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje,
              sala
            }
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
          case 'noquiero':
            var me;
            users.forEach(us => {
              me = `${us.name} no quiere`
              if (us.name === res.jugador.name) {
                if (sala.cantosenmano.boolRealEnvido) {
                  if (sala.cantosenmano.boolReEnvido) {
                    if (sala.cantosenmano.boolEnvido) {
                      us.tantos += 7
                    } //se canto envido realenvido y dsp la falta
                    else {
                      us.tantos += 5
                    } //se canto solo real envido y dsp la falta
                  } //se cantó envido envido realenvido y dsp la falta
                  else {
                    if (sala.cantosenmano.boolEnvido) {
                      us.tantos += 2
                    } //se canto envido realenvido y dsp la falta
                    else {
                      us.tantos += 1
                    } //se canto solo real envido y dsp la falta
                  }
                }
                else {
                  if (sala.cantosenmano.boolReEnvido) {
                    us.tantos += 4
                  } //se canto envido reenvido y dsp la falta
                  else {
                    if (sala.cantosenmano.boolEnvido) {
                      us.tantos += 2
                    } //se canto envido y dsp la falta
                    else {
                      us.tantos += 1  //solo se canto la falta
                    }
                  }
                }
              }
              //solo se cantó real envido
            }
            )
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje: me,
              sala
            }
            let jff = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jff)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
        }
        //socket.to(res.sala).emit('cantando', res)

        break;
      case 'truco':
        switch (res.respuesta) {
          case 'quiero':
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            let jjf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jjf)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;  //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          case 'noquiero':
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            let data = { mensaje, jugador: res.jugador, sala }
            users.forEach(element => {
              if (element.id == res.jugador.id) {
                element.tantos += 1;
              }
            })
            sala.finish = true;
            sala.save();
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users, finish: true } })
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', data)
            console.log("dentro del no quiero y finish es: ", sala.finish)
            if (sala.finish) {
              await terminar(sala)
              setTimeout(() => {
                repartir(sala)
                console.log("repartido")
              }, 5000); //reparte a los 5 segundos
            }

            break;
          default:
            res.canto = res.respuesta;
            res = await booleanos(res);
            // console.log(res)
            socket.to(res.sala).emit('cantando', res)
            break;
        }
        break;
      case 'reTruco':
        switch (res.respuesta) {
          case 'quiero':
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            let jfz = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jfz)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          case 'noquiero':
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            let data = { mensaje, jugador: res.jugador, sala }
            users.forEach(element => {
              if (element.id == res.jugador.id) {
                element.tantos += 2;
              }
            })
            sala.finish = true;
            sala.save();
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            //FIN DE LA MANO, LLAMAR A LA FUNCION PARA RESETEAR Y REPARTIR
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', data)
            console.log("dentro del no quiero y finish es: ", sala.finish)
            if (sala.finish) {
              await terminar(sala)
              setTimeout(() => {
                repartir(sala)
                console.log("repartido")
              }, 5000); //reparte a los 5 segundos
            }

            break;
          default:
            res.canto = res.respuesta;
            res = await booleanos(res);
            // console.log(res)
            socket.to(res.sala).emit('cantando', res)
            break;
        }

        break;
      case 'valeCuatro':
        switch (res.respuesta) {
          case 'quiero':
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            let jf = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jf)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          case 'noquiero':
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }
            users.forEach(element => {
              if (element.id == res.jugador.id) {
                element.tantos += 3;
              }
            })
            sala.finish = true;
            sala.save();
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            /////////////////////////////////////////////////////////////////////////////////////////////////////
            //FIN DE LA MANO, LLAMAR A LA FUNCION PARA RESETEAR Y REPARTIR
            let jfg = await juegoFinalizado(res.sala)
            console.log("juego finalizado?: ", jfg)
            io.to(res.sala).emit('resultadoDeCanto', datos)
            console.log("dentro del no quiero y finish es: ", sala.finish)
            if (sala.finish) {
              await terminar(sala)
              setTimeout(() => {
                repartir(sala)
                console.log("repartido")
              }, 5000); //reparte a los 5 segundos
            }
            break;
        }
        break;
      case 'flor':
        switch (res.respuesta) {
          case 'aceptar':

            users.forEach(element => {
              if (element.id == res.jugador.id) {

                element.tantos += 3;
              }
            })
            break;
          default:
            res.canto = res.respuesta;
            res = await booleanos(res);
            // console.log(res)
            socket.to(res.sala).emit('cantando', res)
            break;
        }

        break;
      case 'florflor':
        switch (res.respuesta) {
          case 'quiero':
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 6
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 6
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                users[1].tantos += 6;
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                users[0].tantos += 6;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              datos = {
                mensaje,
                res
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR

          case 'no quiero':
            users.forEach(element => {
              if (element.id == res.jugador.id) {
                console.log("dentro del for flor")
                element.tantos += 4;
              }
            })

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            mensaje = `sumados los 4 puntos`
            datos = {
              mensaje,
              sala
            }
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
          default:

            res.canto = res.respuesta;
            res = await booleanos(res);
            // console.log(res)
            socket.to(res.sala).emit('cantando', res)
            break;

        }

        break;
      case 'florMeAchico':
        switch (res.respuesta) {
          case 'aceptar':

            var me;
            users.forEach(us => {
              if (us.name === res.jugador.name) {
                us.tantos += 4
              } else {
                me = `${us.name} con flor se achica`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje: me,
              sala
            }
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;
        }
        break;
      case 'contraflor':
        switch (res.respuesta) {
          case 'quiero':
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 30
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 30
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                users[1].tantos += 30;
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                users[0].tantos += 30;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              datos = {
                mensaje,
                res
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;

          case 'no quiero':
            var me;
            users.forEach(us => {
              if (us.name === res.jugador.name) {
                us.tantos += 4
              } else {
                me = `${us.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            datos = {
              mensaje: me,
              sala
            }
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;


        }

    }
  }////////////////////////////////////////////////////////////////////
  )

  //ESTA FUNCION ES PARA CUANDO UN USUARIO ABANDONA CLICKEANDO LA OPCION DE ABANDONAR
  socket.on('abandonarSala', async (res) => {
    //busco la sala que debo cerrar
    try {
      const sala = await salaM.findOne({ name: res.sala })
      //capturo los usuarios que estan en esa sala
      const users = sala.usuarios
      const admin = await adminA.findOne({})
      let usuarioAbandono;
      users.forEach(async (element) => {
        //el usuario con el id distinto de quien abandona gana la apuesta
        if (res.idUser != element.id.toHexString()) {
          element.credito += 2 * sala.apuesta * porcentajePremio
          admin.earning += 2 * sala.apuesta * (1 - porcentajePremio)
          users.save()
          admin.save()
        } else {
          usuarioAbandono = element
        }
      })
      //una vez guardado las ganancias al admin y premio al usuario, procedo a eliminar la sala
      /****************************************
       * *****************ANTES REDIRECCIONO A LOS USUARIOS AL LOBBY Y LE AVISO AL VENCEDOR Q ABANDONARON y al aceptar lo mando al lobby
       * ************************************************************
       *  ************************************************************ */
      let mensaje = `${usuarioAbandono.name} abandonó el juego`
      let data = { mensaje, jugador: usuarioAbandono, sala }
      socket.to(res.sala).emit('resultadoDeCanto', data)

      await salaM.findOneAndDelete({ name: res.sala })
      salaM.save()
    } catch (err) {
      console.log("error en abandonar sala, el error es : ", err)
    }
  })

  //esta función es para cuando uno se va al mazo, recibe un res con la sala y el jugador q abandono
  socket.on('meVoyAlMazo', async (res) => {
    const sala = await salaM.findOne({ name: res.sala })
    let ganador, abandono;
    //capturo los usuarios que estan en esa sala
    const users = sala.usuarios
    users.forEach(async (element) => {
      //el usuario con el id distinto de quien abandona gana la apuesta
      if (res.jugador.id != element.id.toHexString()) {
        ganador = element
      } else {
        abandono = element
      }
    })
    if (abandono.mano) {

    }
    //si el que abandonó era mano y aun no tiro ninguna carta 
    //no mintio? 
    //le sumo 1 x la mentira
    //si ya mintio no hago nada xq se repartieron los puntos de la mentira

    //miro lo del rabon

    //si era mano y ya tiro una carta...
    //el otro ya tiró?
    //miro solo el rabon
    //mintieron?
    //sumo 1 si no mintieron x la mentira
    //si ya mintieron no hago nada xq ya se repartieron los puntos

    //miro el rabon

    //si no era mano, quiere decir q el otro ya tiró una carta...
    //si hubo mentira no hago nada,
    //si no hubo y aun no tiró carta sumo 1 de mentira


  })

});

/* const meVoyAlMazo = async (salaX, jugadorGanador) => {

} */


//ESTA FUNCION ES PARA CUANDO UN USUARIO SALIÓ Y PASA DETERMINADO TIEMPO O SE DESCONECTO Y DEBO ELIMINAR LA SALA, 
const destruirSala = async (salaX, idGanador) => { //
  try {
    const sala = await salaM.findOne({ name: salaX })
    const users = sala.usuarios
    const admin = await adminA.findOne({})
    users.forEach(async (element) => {
      //entrego premio y guardo ganancia
      if (res.idUser === idGanador.toHexString()) {
        element.credito += 2 * sala.apuesta * porcentajePremio
        admin.earning += 2 * sala.apuesta * (1 - porcentajePremio)
        users.save()
        admin.save()
      }
    })
    //ahora destruyo sala y emito a ambos el cartel de juego terminado y al aceptar los mandamos al lobby
    let mensaje = `El juego ha terminado...`
    let data = { mensaje, sala }
    io.to(res.sala).emit('resultadoDeCanto', data)

    await salaM.findOneAndDelete({ name: res.sala })
    salaM.save()

  } catch (err) {
    console.log("error en destruir sala, el error es : ", err)
  }
}











const booleanos = async (res) => {
  const sala = await salaM.findOne({ name: res.sala });
  const users = sala.usuarios;
  switch (res.canto) {
    case 'envido':
      sala.cantosenmano.boolEnvido = true;
      sala.cantosenmano.boolTruco = false;

      break;
    case 'reEnvido':
      sala.cantosenmano.boolReEnvido = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'realEnvido':
      sala.cantosenmano.boolRealEnvido = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'faltaEnvido':
      sala.cantosenmano.boolFaltaEnvido = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'flor':
      sala.cantosenmano.boolFlor = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'florFlor':
      sala.cantosenmano.boolFlorFlor = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'florMeachico':
      sala.cantosenmano.boolFlorMeAchico = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'contraFlor':
      sala.cantosenmano.boolContraFlor = true;
      sala.cantosenmano.boolTruco = false;
      break;
    case 'truco':
      sala.cantosenmano.boolTruco = true;
      users.forEach(element => {
        if (element.id == res.jugador.id) {
          element.puedeCantar = false
        } else {
          element.puedeCantar = true
        }
      })
      break;
    case 'reTruco':
      sala.cantosenmano.boolReTruco = true;
      users.forEach(element => {
        if (element.id == res.jugador.id) {
          element.puedeCantar = false
        } else {
          element.puedeCantar = true
        }
      })
      break;
    case 'valeCuatro':
      sala.cantosenmano.boolValeCuatro = true;
      break;
  }
  res.cantosenmano = sala.cantosenmano;
  sala.save();
  return (res)
}




//al terminar la partida sumo los tantos deacuerdo a lo cantado y al jugador q ganó
const sumarTantosAPartida = async (salaX, jugador) => {
  let sala = await salaM.findById({ _id: salaX._id });
  let usuarios = sala.usuarios;
  console.log("sala dentro de sumarTantosAPartida ")
  console.log("boleanos: ", sala.cantosenmano)
  if (sala.cantosenmano.boolValeCuatro) {
    console.log("llegamos al valecuatro")
    usuarios[jugador].tantos += 4;
  } else {
    if (sala.cantosenmano.boolReTruco) {
      console.log("llegamos al retruco")
      usuarios[jugador].tantos += 3;
    } else {
      if (sala.cantosenmano.boolTruco) {
        console.log("llegamos al truco")
        sala.usuarios[jugador].tantos += 2;
      } else {
        console.log("no hubo rabon")
        usuarios[jugador].tantos += 1;
      }
    }
  } try {

    await salaM.findByIdAndUpdate({ _id: salaX._id }, { $set: { usuarios: usuarios } })
  } catch (err) { console.log(err) }

  return
}




//Acá tengo que pasar los dos jugadores que están en la sala cada vez que se tira
//COMPARA VALORES DE LAS CARTAS PERO DETERMINA SI TERMINÓ LA MANO CON TRUE O FALSE
//Y LLAMA A sumarTantosAPartida (QUE SUMA SOLO EL RABON) SI YA TERMINÓ
const compararValores = async (sala) => {
  //Aquí, se obtienen las últimas jugadas de cada jugador.
  let users = sala.usuarios;
  let jugador1 = users[0];
  let jugador2 = users[1];
  const jugada1 = jugador1.jugada[jugador1.jugada.length - 1]
  const jugada2 = jugador2.jugada[jugador2.jugada.length - 1]

  //Este if verifica que ambos jugadores tengan el mismo número de jugadas. Si no es así, se ejecutará el bloque else.
  if (jugador1.jugada.length === jugador2.jugada.length) {
    if (jugada1.valor === jugada2.valor) {
      if (jugador2.jugada.length === 1) {//si son iguales y es la primer mano van parda en primer mano
        sala.cantosenmano.pardaPrimera = true;
        jugador2.juega = !jugador2.juega;
        jugador1.juega = !jugador1.juega;
        sala.save();
        await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { cantosenmano: sala.cantosenmano } });
        console.log('empate parda en primera') //ya devuelve avisando que es primera y parda
        return false
      }
      //aca va si tienen el mismo valor pero no es la primera carta, puede ser la segunda o 3ra
      if (jugador2.jugada.length === 2) {//comparo con 1 solo ya que tienen la misma cantidad de jugadas
        if (sala.cantosenmano.pardaPrimera) {
          sala.finish = true;
          sala.save();
          if (users[0].mano) {
            await sumarTantosAPartida(sala, 0)
            console.log('Gana ', users[0].name, 'por mano en parda en primera...')
            return true
          }
          else {
            await sumarTantosAPartida(sala, 1)
            console.log('Gana ', users[1].name, 'por mano en parda en primera')
            return true
          }
        } else {
          if (users[0].ganoPrimera) {
            await sumarTantosAPartida(sala, 0)
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            console.log('Gana ', users[0].name, 'habia ganado en primera')
            return true
          }
          else {
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            await sumarTantosAPartida(sala, 1)
            console.log('Gana ', users[1].name, 'habia ganado en primera')
            return true
          }

        }


      } //
      if (jugador2.jugada.length === 3) {//comparo con 1 solo ya que tienen la misma cantidad de jugadas

        if (users[0].ganoPrimera) {
          await sumarTantosAPartida(sala, 0)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          console.log('Gana ', users[0].name, ' parda ultima carta y habia ganado en primera')
          return true
        }
        else {
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          await sumarTantosAPartida(sala, 1)
          console.log('Gana ', users[1].name, ' parda ultima carta y habia ganado en primera ')
          return true
        }
      }
    }
    if (jugada1.valor > jugada2.valor) {
      jugador1.juega = true;
      jugador2.juega = false;
      if (jugador2.jugada.length === 1) {
        jugador1.ganoPrimera = true; //si es la primera jugada solo anoto que gano la primera y le vuelve a tocar jugar
        console.log('Gana ', users[0].name, ' primera jugada ')
        return false
      }
      if (jugador1.jugada.length === 2) { //si es la 2da jugada y ya gano primera termina la ronda y le sumo los puntos de lo cantado
        if (users[0].ganoPrimera) {
          await sumarTantosAPartida(sala, 0)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          console.log('Gana ', users[0].name, ' segunda jugada  y ya tenia primera')
          return true
        }

        console.log('Gana ', users[0].name, ' segunda jugada ')
        return false
      }
      if (jugador1.jugada.length === 3) {//si gana en la 3ra le sumo los puntos de lo cantado
        await sumarTantosAPartida(sala, 0)
        await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
        console.log('Gana ', users[0].name, ' tercera jugada')
        return true
      }

    } else {
      //Si el valor de la última jugada del jugador 2 es mayor, se incrementa el puntaje del jugador 2 
      jugador1.juega = false;
      jugador2.juega = true;
      if (jugador2.jugada.length === 1) {
        jugador2.ganoPrimera = true;
        console.log('Gana ', users[1].name, ' primera jugada ')
        return false
      }
      if (jugador2.jugada.length === 2) {
        if (users[1].ganoPrimera) {
          await sumarTantosAPartida(sala, 1)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          console.log('Gana ', users[1].name, ' ronda xq habia ganado en primera tambien ')
          return true
        }
      }
      if (jugador2.jugada.length === 3) {
        await sumarTantosAPartida(sala, 1)
        await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
        console.log('Gana ', users[1].name, ' ronda en tercera jugada ')
        return true
      }

    }

  } else {
    //Si los jugadores no tienen el mismo número de jugadas no se puede hacer la comparación.
    jugador2.juega = !jugador2.juega;
    jugador1.juega = !jugador1.juega;
    return false
  }
}
//Acá tengo que pasar los dos jugadores que están en la sala actualizados cada vez que se tira
const terminar = async (salaX) => {
  let sala = await salaM.findOne({ name: salaX.name })
  console.log("dentro de funcion terminar...la variable finish es: ", sala.finish)
  if (sala.finish) {
    sala.partida += 1
    console.log("partida terminada")
    let terminoTodo = await juegoFinalizado(sala)







    //asdfsadasdasdasdasdasdasdasdasdasdasdasdasdasdasdasd










  } else {
    console.log('Aun no termina, siga')
  }
}

const juegoFinalizado = async (salaX) => {
  try {
    let sala = await salaM.findOne({ name: salaX.name })
    console.log("sala:", sala);

    let usuarios = sala.usuarios
    console.log("usuarios", usuarios)
    usuarios.forEach(e => {
      if (e.tantos >= 30) {
        sala.juegoFinalizado = true;
      }
    })
    if (sala.juegoFinalizado) {
      return true;
    } else {
      "todavia no termina el juego, se sigue nomas"
      return false
    }
  } catch (err) {
    console.log("un error en el backend en juegoFinalizado, error: ", err);

  }
}

//La función getRandomInt está diseñada para generar un número entero aleatorio entre dos valores, min (incluido) y max (excluido).
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  valor = Math.floor(Math.random() * (max - min) + min);
}

//Función que reparte tres cartas diferentes a cada jugador.
const repartir = async (_sala) => {
  //Se recibe la sala para la que hay que repartir y se busca en la base de datos
  const salaOn = await salaM.findOne({ _id: _sala._id })
  //Obtenemos los usuarios de la sala encontrada 
  const users = salaOn.usuarios
  salaOn.finish = false;
  //A esos usuarios los pasamos como argumento a la función repartir que es la que va a asignar 3 cartas a cada jugador
  let jugador1 = users[0];
  let jugador2 = users[1];
  jugador1.valores = [];
  jugador2.valores = [];
  jugador1.jugada = [];
  jugador2.jugada = [];
  jugador1.puntosMentira = 0;
  jugador2.puntosMentira = 0;

  jugador1.ganoPrimera = false;
  jugador2.ganoPrimera = false;
  let values = [];
  for (let i = 0; i < 6; i++) {
    getRandomInt(1, 40)
    values.forEach(e => {
      if (e === valor) {
        var index = values.indexOf(e);
        values.splice(index, 1)
        i--
      }
    })
    values.push(valor)
  }
  const allCartas = await cartaM.find({})

  for (let i = 0; i < 3; i++) {
    let card = {
      name: allCartas[values[i]].name,
      valor: allCartas[values[i]].valor
    }
    jugador1.valores.push(allCartas[values[i]])
  }
  for (let i = 3; i < 6; i++) {
    let card = {
      name: allCartas[values[i]].name,
      valor: allCartas[values[i]].valor
    }
    jugador2.valores.push(allCartas[values[i]])
  }
  let temp1 = tieneEnvido(jugador1.valores, 1);
  let temp2 = tieneEnvido(jugador2.valores, 2);
  jugador1.puntosMentira = temp1.puntos;
  jugador2.puntosMentira = temp2.puntos;
  jugador1.puedeFlor = temp1.flor;
  jugador2.puedeFlor = temp2.flor;
  salaOn.cantosenmano.boolEnvido = false;
  salaOn.cantosenmano.boolReEnvido = false;
  salaOn.cantosenmano.boolRealEnvido = false;
  salaOn.cantosenmano.boolFaltaEnvido = false;
  salaOn.cantosenmano.boolFlor = false;
  salaOn.cantosenmano.boolFlorFlor = false;
  salaOn.cantosenmano.boolFlorMeAchico = false;
  salaOn.cantosenmano.boolContraFlor = false;
  salaOn.cantosenmano.boolTruco = false;
  salaOn.cantosenmano.boolReTruco = false;
  salaOn.cantosenmano.boolValeCuatro = false;
  salaOn.finish = false;
  salaOn.cantosenmano.pardaPrimera = false;
  if (users[0].mano) {
    users[1].mano = true;
    users[0].mano = false;
    users[1].juega = true;
    users[0].juega = false;
    users[1].puedeCantar = true;
    users[0].puedeCantar = false;
    users[1].puedeMentir = true;
    users[0].puedeMentir = true;
  } else {
    users[0].mano = true;
    users[1].mano = false;
    users[0].juega = true;
    users[1].juega = false;
    users[1].puedeCantar = false;
    users[0].puedeCantar = true;
    users[1].puedeMentir = true;
    users[0].puedeMentir = true;
  }
  salaOn.save();
  /*   const paraGuardar = await salaM.findOne({ _id: _sala._id })
    //Una vez que cada jugador tiene sus cartas se actualiza la sala
    await salaM.findByIdAndUpdate({ _id: paraGuardar._id }, { $set: { usuarios: users } })
   */
  //Una vez que se actualiza, se busca la sala (la acción anterior me devuelve la sala sin actualizar, por eso este paso adicional) y se devuelve a travez del emit 'repartir'
  const salaActualizada = await salaM.findOne({ _id: salaOn._id })
  console.log("booleano finish: ", salaOn.finish)
  io.to(salaOn.name).emit('repartir', salaOn)

}
//La función tieneEnvido determina si hay "envido" en una mano de cartas, y calcula los puntos de envido para un jugador específico.
const tieneEnvido = (val, num) => {
  let pts = 20;

  //palo1, palo2, palo3: Se extraen las letras de las cadenas de texto name de las tres cartas. Se usa una expresión regular para obtener solo las letras.
  let palo1 = val[0].name.match(/[a-zA-Z]+/g).join('');
  let palo2 = val[1].name.match(/[a-zA-Z]+/g).join('');
  let palo3 = val[2].name.match(/[a-zA-Z]+/g).join('');

  //Se verifica si hay al menos dos cartas con el mismo palo, lo cual es necesario para el envido.
  if (palo1 === palo2 && palo2 === palo3) {//si tiene los 3 iguales tiene una flor
    if (parseInt(val[0].name) < 10) { pts += parseInt(val[0].name) }
    if (parseInt(val[1].name) < 10) { pts += parseInt(val[1].name) }
    if (parseInt(val[2].name) < 10) { pts += parseInt(val[2].name) }

    return {
      mensaje: `El jugador ${num} tiene flor de ${pts} puntos`,
      jugadorNum: num,
      puntos: pts,
      flor: true
    }

  } else {
    if (palo1 === palo2 || palo1 === palo3 || palo2 === palo3) {
      //Si hay al menos dos cartas con el mismo palo, se calcula los puntos del envido usando la función sumaPts.
      let primRes = sumaPts(palo1, palo2, val[0].name, val[1].name, num)
      let segRes = sumaPts(palo1, palo3, val[0].name, val[2].name, num)
      let terRes = sumaPts(palo2, palo3, val[1].name, val[2].name, num)
      //Si alguna de las combinaciones tiene envido, se retorna el resultado de sumaPts.
      if (primRes) { return primRes }
      if (segRes) { return segRes }
      if (terRes) { return terRes }
    } else {
      //Si no hay dos cartas con el mismo palo, se calcula el punto más alto de las tres cartas.
      // Se convierte cada nombre de carta a un número usando parseInt.
      // Se encuentra el valor máximo entre las tres cartas.
      // Si el valor máximo es mayor que 10, se ajusta a 10 
      let val0 = parseInt(val[0].name)
      let val1 = parseInt(val[1].name)
      let val2 = parseInt(val[2].name)
      let max;
      if (val0 >= 10 && val1 >= 10 && val2 >= 10) {
        max = 10
      } else {
        const menoresOIgualesADiez = [val0, val1, val2].filter(val => val < 10);
        max = Math.max(...menoresOIgualesADiez);
      }

      // Se crea y retorna un objeto puntosFinales que contiene un mensaje, el número del jugador y los puntos calculados.
      let puntosFinales = {
        mensaje: `El jugador ${num} tiene ${max} puntos`,
        jugadorNum: num,
        puntos: max,
        flor: false
      }
      return puntosFinales
    }
  }
  //Devuelve un array solo con los números
  //variable.match(/\d+/g)
  //Solo devuelve letras
  //cadena.match(/[a-zA-Z]+/g).join('');
}


//Parámetros de Entrada:
//carta1: El palo de la primera carta.
// carta2: El palo de la segunda carta.
// valor1: El valor de la primera carta.
// valor2: El valor de la segunda carta.
// num: El número del jugador para el cual se están calculando los puntos.
const sumaPts = (carta1, carta2, valor1, valor2, num) => {
  if (carta1 === carta2) {
    //Convierte los valores de las cartas a enteros.
    //Si el valor de alguna carta es mayor que 10, se ajusta a 10
    let priValor = parseInt(valor1)
    let segValor = parseInt(valor2)
    if (parseInt(valor1) > 10) {
      priValor = 10
    }
    if (parseInt(valor2) > 10) {
      segValor = 10
    }
    //Calcula los puntos sumando los valores de las cartas y agregando 10 puntos de envido base.
    pts = priValor + segValor + 10
    // Si ambas cartas tienen valores menores a 10, se añaden 10 puntos adicionales.
    if (parseInt(valor2) < 10 && parseInt(valor1) < 10) {
      pts += 10
    }
    // Si ambas cartas tienen valores mayores a 9, se ajusta el puntaje a 20 (esto cubre el caso de dos cartas de figura, que suman 20 puntos de envido).
    if (parseInt(valor2) > 9 && parseInt(valor1) > 9) {
      pts = 20
    }
    //Crea un objeto puntosFinales que contiene un mensaje con los puntos de envido, el número del jugador y los puntos calculados.
    let puntosFinales = {
      mensaje: `El jugador ${num} tiene ${pts} puntos`,
      jugadorNum: num,
      puntos: pts
    }
    return puntosFinales
  }
}




