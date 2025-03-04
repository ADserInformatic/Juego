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
      if (sala.usuarios.length == 2) {
        if ((sala.usuarios[0].valores.length == 0 && sala.usuarios[1].valores.length == 0) || (!sala.usuarios[0].valores && !sala.usuarios[1].valores)) { await repartir(sala) }
      }
    }
    catch (err) {
      //console.log("no existe la sala")
      console.log("error: ", err)
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
    let idUltimoTiro;
    users.forEach(async (element) => {
      //Recorro los usuarios en esa sala y al que coincide con el id del que hizo la jugada se le actualizan los datos
      if (jugada.idUser === element.id.toHexString()) {
        idUltimoTiro = element.id.toHexString();
        //Esto lo que hace es filtrar todas la cartas que no coinciden con la que tiró, ya que son las que le quedan
        element.valores = element.valores.filter(e => e.name != jugada.carta)
        //Agregamos la nueva jugada al usuario en cuestión
        let existe = element.jugada.find(e => e.carta === jugada.carta)
        if (!existe) {
          element.jugada.push(jugada) //si no existe la jugada, la agrega
          element.puedeFlor = false;//al tirar una carta ya no puede cantar flor
          element.puedeMentir = false;//al tirar una carta ya no puede mentir
          if (element.jugada.length == 1) { //si es la primer carta tirada 
            if (!element.cantoFlor && element.tieneFlor) {
              await corregirPuntos(element.id, jugada.sala)

            }
          }
        }
      }
    })
    //Una vez que se actualiza la jugada al usuario que la realizá, se compara los valores. La función compararValores compara las últimas jugadas de los jugadores y actualiza el puntaje dependiendo del resultado de la comparación.
    let terminoMano = await compararValores(salaOn) //dentro de comparar valores comprueba en q tiro estan y suma puntos, indica si termino la mano con true o false
    const newSalaOn = await salaM.findOne({ name: jugada.sala })
    const usersUpdate = newSalaOn.usuarios;
    for (i = 0; i < usersUpdate.length; i++) {
      users[i].tantos = usersUpdate[i].tantos
    }
    //console.log("termino la Mano?: ", terminoMano)
    //Una vez actualizado el usuario se actualiza la sala
    await salaM.findByIdAndUpdate({ _id: salaOn._id }, { $set: { usuarios: users, partida: salaOn.partida } })
    //Una vez actualizada la sala se vuelve a buscar para devolverla al front (el update no devuelve el objeto actualizado, por eso este paso extra)
    const salaCasiActualizada = await verificarCantora(salaOn.name, idUltimoTiro);
    let salaActualizada = await salaM.findOne({ _id: salaOn._id })
    if (salaCasiActualizada) {
      console.log("devolvi bien")
      io.to(salaOn.name).emit('muestra', salaCasiActualizada) //muestra la ultima carta tirada, 
    } else {
      console.log("devolvi mal")
      io.to(salaOn.name).emit('muestra', salaActualizada) //muestra la ultima carta tirada, 
    }

    //Una vez hecho todo esto se emite hacia el front la sala con los nuevos datos

    //La función terminar determina si una partida entre dos jugadores ha terminado basándose en el número de jugadas realizadas y declara al ganador
    if (terminoMano) { //si terminó la mano
      /*       salaOn.finish = true; //ya deberia estar igual en true xq lo hace dentro de comparar valores o al no querer los rabones
            salaOn.save() */
      //SI TERMINO LA MANO PREGUNTO SI TERMINO EL JUEGO
      let terminoJuego = await terminar(salaOn) //vuelve a repartir y suma partidas pero si ya termino el juego devuelve true o false
      //console.log("termino el juego? dentro de tirar: ", terminoJuego)
      if (!terminoJuego) { //si el resultado de la funcion terminar es falso, se sigue el juego y se reparte, solo termino una mano
        setTimeout(() => {
          repartir(salaActualizada)
        }, 3000); //reparte a los 5 segundos
      } else {
        //console.log("dentro de socket tirar, termino juego dsp de tirar cartas")
        try {
          let winner;
          if (users[0].tantos > users[1].tantos) {
            winner = users[0].id
          } else {
            winner = users[1].id
          }
          await juegoTerminado(salaOn, winner)
        } catch (err) {
          console.log("error en destruir sala, el error es : ", err)
        }
      }
    }

  })

  //Cuando un jugador canta (envido, flor o truco), se emite al otro jugador el canto y, en caso de requerirse, se espera una respuesta.
  socket.on('canto', async (res) => {
    let ores = await booleanos(res);
    const sala = await salaM.findOne({ name: res.sala });
    const users = sala.usuarios;
    let corregir = false;
    let idAcorregir;
    if (res.canto == 'envido' || res.canto == 'reenvido' || res.canto == 'realEnvido' || res.canto == 'faltaEnvido' || res.canto == 'flor') {
      if (sala.cantosenmano.boolTruco) {
        sala.cantosenmano.boolTruco = false;
        ores.cantosenmano.boolTruco = false;
        users.forEach(element => {
          element.puedeCantar = true
          ores.jugador.puedeCantar = true
        })
      }
      if (res.canto == 'envido' || res.canto == 'reenvido' || res.canto == 'realEnvido' || res.canto == 'faltaEnvido') { //si el q canta es quien tiene cantora, aun no lo permite el front
        users.forEach(element => {
          if (element.id === res.jugador.id) {
            if (element.tieneFlor) {
              element.puedeFlor = false;
              element.cantoFlor = false;
              corregir = true;
              idAcorregir = element.id
            }

          }
        })

        //corregir puntos del que no cantó flor
        // si el que tiene flor es el mismo q miente bloquea flor y corrige puntos
        // si miente quien no tiene flor y no es mano, el otro ya no canto flor y debo corregir puntos
        // si quien miente es mano debo dejarle habilitada la flor por si la canta pero si revira debo corregir.


      }
      if (res.canto == 'flor') {
        users.forEach(element => {
          if (element.id === res.jugador.id) {
            if (element.tieneFlor) {
              element.puedeFlor = false;
              element.cantoFlor = true;
            }

          }
        })
      }
    }
    if (corregir) {
      await corregirPuntos(idAcorregir, res.sala)
      console.log("puntos corregidos")
      console.log("nuevosPuntajes Jugador1: ", sala.usuarios[0].puntosMentira)
      console.log("nuevosPuntajes Jugador2: ", sala.usuarios[1].puntosMentira)
    }
    sala.save()
    socket.to(res.sala).emit('cantando', ores)
  })

  //Esto está recibiendo tanto envido como truco y flor. ¡Tener eso en cuenta!
  socket.on('respuestaCanto', async (res) => {
    let sala = await salaM.findOne({ name: res.sala })
    let users = sala.usuarios
    let datos, terminado, winner
    let mensaje;
    let canto = res.canto
    res = await booleanos(res);
    if (res.canto == 'envido' || res.canto == 'reenvido' || res.canto == 'realEnvido' || res.canto == 'faltaEnvido') {
      if (res.respuesta == "quiero") {
        if (res.jugador.tieneFlor) {//si quien dice quiero tiene flor
          if (res.jugador.jugada.length == 0) { //si aun no ha tirado ninguna carta xq sino ya esta corregido
            await corregirPuntos(res.jugador.id, res.sala)
            sala = await salaM.findOne({ name: res.sala })
            users = sala.usuarios
          }
        }

      }
    }

    switch (canto) {
      case 'envido':
        switch (res.respuesta) {
          case 'quiero':
            try {
              sala.cantosenmano.faltaRespuesta = false;
              sala.cantosenmano.puntosDevolver = 2;
              //Acá paso los usuarios a la función que calcula los puntos
              if (users[0].puntosMentira > users[1].puntosMentira) {
                users[0].tantos += 2
                sala.cantosenmano.posGanMentira = 0;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
                winner = users[0].id


              }
              if (users[0].puntosMentira < users[1].puntosMentira) {
                users[1].tantos += 2
                winner = users[1].id
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                sala.cantosenmano.posGanMentira = 1;

              }
              if (users[0].puntosMentira == users[1].puntosMentira) {
                if (users[1].mano == true) {
                  users[1].tantos += 2;
                  mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
                  winner = users[1].id
                  sala.cantosenmano.posGanMentira = 1;

                } else {
                  users[0].tantos += 2;
                  mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
                  winner = users[0].id
                  sala.cantosenmano.posGanMentira = 0;

                }
              }
              sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
                //console.log("dentro del envido y quiero, terminar arrojo true y le paso a juegoTerminado")
                await juegoTerminado(sala, winner)

              } else {
                datos = {
                  mensaje,
                  sala
                }
                io.to(res.sala).emit('resultadoDeCanto', datos)

              }
            } catch (err) { console.log("error en envido envido quiero: ", err) }
            break;
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.cantosenmano.puntosDevolver = 1;
            users.forEach(us => {
              if (us.name != res.jugador.name) {
                us.tantos += 1
                winner = us.id
                sala.cantosenmano.posGanMentira = users.indexOf(us);

              } else {
                mensaje = `${us.name} no quiere`
              }
            })
            sala.save()
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del envido y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
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
      case 'reEnvido':
        switch (res.respuesta) {
          case 'quiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 4
              winner = users[0].id
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 4
              winner = users[1].id
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                users[1].tantos += 4;
                winner = users[1].id
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                winner = users[0].id
                users[0].tantos += 4;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
            }
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del re envido y quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }

            break;
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(us => {
              if (us.name != res.jugador.name) {
                us.tantos += 2
                winner = us.id

              } else {
                mensaje = `${us.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del re Envido y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
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
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            if (users[0].puntosMentira > users[1].puntosMentira) {
              // console.log(sala.cantosenmano)
              if (sala.cantosenmano.boolReEnvido) { users[0].tantos += 7 } //se cantó envido envido realenvido
              else {
                if (sala.cantosenmano.boolEnvido) { users[0].tantos += 5 } //se canto envido realenvido
                else {
                  users[0].tantos += 3
                } //solo se cantó real envido
              }
              winner = users[0].id
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              if (sala.cantosenmano.boolReEnvido) { users[1].tantos += 7 } //se cantó envido envido realenvido
              else {
                if (sala.cantosenmano.boolEnvido) { users[1].tantos += 5 } //se canto envido realenvido
                else {
                  users[1].tantos += 3
                }
              }//solo se cantó real envido}
              winner = users[1].id
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[0].mano) { //gana usuario 0 de mano
                if (sala.cantosenmano.boolReEnvido) { users[0].tantos += 7 } //se cantó envido envido realenvido
                else {
                  if (sala.cantosenmano.boolEnvido) { users[0].tantos += 5 } //se canto envido realenvido
                  else {
                    users[0].tantos += 3
                  }
                }//solo se cantó real envido}
                winner = users[0].id
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              } else { //gana usuario 1 de mano
                if (sala.cantosenmano.boolReEnvido) { users[1].tantos += 7 } //se cantó envido envido realenvido
                else {
                  if (sala.cantosenmano.boolEnvido) { users[1].tantos += 5 } //se canto envido realenvido
                  else {
                    users[1].tantos += 3
                  }
                }//solo se cantó real envido}
                winner = users[1].id
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              }
            }

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del real Envido y quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(us => {
              if (us.name != res.jugador.name) {
                winner = us.id
                if (sala.cantosenmano.boolReEnvido) { us.tantos += 4 } //se cantó envido envido realenvido
                else {
                  if (sala.cantosenmano.boolEnvido) { us.tantos += 2 } //se canto envido realenvido
                  else { us.tantos += 1 }
                }//solo se cantó real envido
              } else {
                mensaje = `${us.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del real Envido y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
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
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            if (users[0].puntosMentira > users[1].puntosMentira) {
              winner = users[0].id
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              if (sala.unaFalta) {
                users[0].tantos += 30 - users[1].tantos;
              } else {
                if (user[1].tantos < 15) {
                  users[0].tantos += 15 - users[1].tantos;
                }
                else {
                  users[0].tantos += 30 - users[1].tantos;
                }
              }

            } else {
              if (users[1].puntosMentira > users[0].puntosMentira) {
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                winner = users[1].id
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
                    winner = users[0].id
                    if (sala.unaFalta) {
                      users[0].tantos += 30 - users[1].tantos;
                    } else {
                      if (user[1].tantos < 15) { users[0].tantos += 15 - users[1].tantos; }
                      else { { users[0].tantos += 30 - users[1].tantos; } }
                    }
                  } else {
                    mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos POR MANO`
                    winner = users[1].id
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
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro de la falta y quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(us => {
              if (us.name != res.jugador.name) {
                winner = us.id
                if (sala.cantosenmano.boolRealEnvido) {
                  if (sala.cantosenmano.boolReEnvido) {
                    if (sala.cantosenmano.boolEnvido) {
                      us.tantos += 7
                    } //se canto envido realenvido y dsp la falta
                    else {
                      us.tantos += 3
                    } //se canto solo real envido y dsp la falta
                  } //se cantó envido envido realenvido y dsp la falta
                  else {
                    if (sala.cantosenmano.boolEnvido) {
                      us.tantos += 5
                    } //se canto envido realenvido y dsp la falta
                    else {
                      us.tantos += 3
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
              } else { mensaje = `${us.name} no quiere` }
              //solo se cantó real envido
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro de la falta y quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
        }
        //socket.to(res.sala).emit('cantando', res)

        break;
      case 'truco':
        switch (res.respuesta) {
          case 'quiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break;  //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta.bool = false;
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            users.forEach(element => {
              if (element.id != res.jugador.id) {
                element.tantos += 1;
                winner = element.id;
              }
            })
            sala.finish = true;
            await sala.save();

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users, finish: true } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del truco y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                jugador: res.jugador,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
              //console.log("dentro del no quiero y finish es: ", sala.finish)
              if (sala.finish) {
                await terminar(sala)
                setTimeout(() => {
                  repartir(sala)
                  //console.log("repartido")
                }, 4000); //reparte a los 5 segundos
              }
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
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            io.to(res.sala).emit('resultadoDeCanto', datos)
            break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta.bool = false;
            users.forEach(element => {
              if (element.id != res.jugador.id) {
                element.tantos += 2;
                winner = element.id
              }
            })
            sala.finish = true;
            sala.save();
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del retruco y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                jugador: res.jugador,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
              //console.log("dentro del no quiero y finish es: ", sala.finish)
              if (sala.finish) {
                await terminar(sala)
                setTimeout(() => {
                  repartir(sala)
                  //console.log("repartido")
                }, 5000); //reparte a los 5 segundos
              }
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
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            datos = { mensaje, jugador: res.jugador, sala }

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

            io.to(res.sala).emit('resultadoDeCanto', datos)
            break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          case 'noquiero':
            sala.cantosenmano.faltaRespuesta = false;
            mensaje = `${res.jugador.name} dice: ${res.respuesta}`
            users.forEach(element => {
              if (element.id != res.jugador.id) {
                element.tantos += 3;
                winner = element.id
              }
            })
            sala.finish = true;
            sala.save();
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del vale cuatro y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {

              datos = {
                mensaje,
                jugador: res.jugador,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)

              //console.log("dentro vale cuatro -- no quiero y finish es: ", sala.finish)
              if (sala.finish) {
                await terminar(sala)
                setTimeout(() => {
                  repartir(sala)
                  //console.log("repartido")
                }, 5000); //reparte a los 5 segundos
              }
            }
            break;
        }
        break;
      case 'flor':
        switch (res.respuesta) {
          case 'aceptar':
            mensaje = ""
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(element => {
              if (element.name != res.jugador.name) {

                element.tantos += 3;
                winner = element.id
              }
            })

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del aceptar de la flor, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
          default:
            res.canto = res.respuesta;
            res = await booleanos(res);
            // console.log(res)
            io.to(res.sala).emit('cantando', res)
            break;
        }

        break;
      case 'florflor':
        switch (res.respuesta) {
          case 'quiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 6
              winner = users[0].id
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 6
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              winner = users[1].id
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                winner = users[1].id
                users[1].tantos += 6;
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                winner = users[0].id
                users[0].tantos += 6;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
            }
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del envido y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
          //este no quiero deberia ser default xq en vez de no quiero es con flor me achico
          case 'no quiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(element => {
              if (element.id != res.jugador.id) {
                winner = element.id
                element.tantos += 4;
              } else {
                mensaje = mensaje = `${element.name} no quiere`
              }
            })
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del flor flor y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)
            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
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
      case 'florMeAchico':
        switch (res.respuesta) {
          case 'aceptar':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(us => {
              if (us.name != res.jugador.name) {
                us.tantos += 4
                winner = us.id
              }
            })
            mensaje = ""

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del envido y no quiero, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;
        }
        break;
      case 'contraflor':
        switch (res.respuesta) {
          case 'quiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            if (users[0].puntosMentira > users[1].puntosMentira) {
              users[0].tantos += 30
              winner = users[0].id
              mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
            }
            if (users[0].puntosMentira < users[1].puntosMentira) {
              users[1].tantos += 30
              winner = users[1].id
              mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
            }
            if (users[0].puntosMentira == users[1].puntosMentira) {
              if (users[1].mano == true) {
                winner = users[1].id
                users[1].tantos += 30;
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
              } else {
                winner = users[0].id
                users[0].tantos += 30;
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
              }
            }
            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            //console.log("dentro del contraflor y quiero, DIRECTO a juegoTerminado")
            await juegoTerminado(sala, winner)
            break;
          case 'no quiero':
            sala.cantosenmano.faltaRespuesta = false;
            sala.save()
            users.forEach(us => {
              if (us.name != res.jugador.name) {
                us.tantos += 4
                winner = us.id
              } else {
                mensaje = `${us.name} no quiere`
              }
            })

            await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
            terminado = await terminar(sala)
            if (terminado) {
              //console.log("dentro del contraflor y no quiero, son 4, terminar arrojo true y le paso a juegoTerminado")
              await juegoTerminado(sala, winner)

            } else {
              datos = {
                mensaje,
                sala
              }
              io.to(res.sala).emit('resultadoDeCanto', datos)
            }
            break;


        }

    }
  }////////////////////////////////////////////////////////////////////
  )

  //ESTA FUNCION ES PARA CUANDO UN USUARIO ABANDONA CLICKEANDO LA OPCION DE ABANDONAR
  socket.on('abandonarSala', async (res) => {
    try {
      const sala = await salaM.findOne({ name: res.sala })
      //capturo los usuarios que estan en esa sala
      let usuarioAbandono;
      if (!sala) {
        //console.log("ya estaba eliminada la sala")
        return
      }


      let idGanador;
      sala.usuarios.forEach(async (element) => {
        //el usuario con el id distinto de quien abandona gana la apuesta
        if (res.idUser != element.id.toHexString()) {
          idGanador = element.id
        } else {
          usuarioAbandono = element
        }
      })

      await juegoTerminado(sala, idGanador);


    } catch (err) {
      console.log("error en abandonar sala, el error es : ", err)
    }
  })

  //esta función es para cuando uno se va al mazo, recibe un res con la sala y el jugador q abandono
  socket.on('meVoyAlMazo', async (res) => {
    const sala = await salaM.findOne({ name: res.sala })
    let posGanador, posAlMazo
    //capturo los usuarios que estan en esa sala
    const users = sala.usuarios
    users.forEach(async (element, index) => {
      //el usuario con el id distinto de quien abandona gana la apuesta
      if (res.jugador.id != element.id.toHexString()) {
        posGanador = index
      } else {
        posAlMazo = index
      }
    })
    if (users[posAlMazo].mano) {
      if (users[posAlMazo].puedeMentir && users[posGanador].jugada.length == 0) {//QUIERE DECIR Q EL Q ABANDONA ES MANO Y NO MINTIO  ni tiro cartas ASI Q SUMA 1 PUNTO AL GANADOR Y MIRO RABONES
        users[posGanador].tantos += 1
      }
    }
    await sumarTantosAPartida(res.sala, users[ganador].id)
    //muestro cartel y reparto
  })

});

//corrijo puntos si tenia flor y no la canto para mentir o aceptar mentira
const corregirPuntos = async (idLLega, nameSala) => {
  try {
    const sala = await salaM.findOne({ name: nameSala });
    const users = sala.usuarios;
    let idJugador;
    if (typeof idLLega.toHexString === 'function') {
      idJugador = idLLega.toHexString()
    } else {
      idJugador = idLLega
    }

    users.forEach(async (element) => {
      if (element.id.toHexString() === idJugador) {
        element.cantoFlor = false;
        let todoMenor9 = true
        let minimo = parseInt(element.valores[0].name)
        //let cartaNegada = element.valores[0]
        element.valores.forEach(async (carta) => { //al terminar obtengo en todoMenor si debo restar el minimo y corrijo puntaje
          if (parseInt(carta.name) > 9) {
            todoMenor9 = false;
          }
          if (parseInt(carta.name) < minimo) {
            //cartaNegada = carta
            minimo = parseInt(carta.name)
          }
        })
        //element.noTirar.push(cartaNegada)
        if (todoMenor9) {
          element.puntosMentira -= minimo;
        }
      }
    })
    await salaM.findOneAndUpdate({ name: nameSala }, { $set: { usuarios: users } })
    return
  } catch (err) {
    console.log("error dentro de corregir puntos y el error es: ", err)
    return
  }
}


//ESTA FUNCION ES PARA CUANDO UN USUARIO GANO por lo que sea y debo repartir premio 
const juegoTerminado = async (salaX, idGanador) => { //
  try {
    const sala = await salaM.findOne({ name: salaX.name })
    const users = sala.usuarios
    const admin = await adminA.findOne({})
    let nombreGanador;
    users.forEach(async (element) => {
      //entrego premio y guardo ganancia
      if (idGanador.toHexString() === element.id.toHexString()) {
        //console.log("ganancias repartidas")
        element.creditos += 2 * sala.apuesta * porcentajePremio
        admin.earning += 2 * sala.apuesta * (1 - porcentajePremio)
        nombreGanador = element.name
        await userM.findByIdAndUpdate({ _id: idGanador }, { $set: { credito: element.creditos } })

      }
    })
    await salaM.findOneAndUpdate({ name: salaX.name }, { $set: { usuarios: users } })
    await admin.save()
    let mensaje = `${nombreGanador} gana el juego`
    let data = {
      mensaje,
      jugador: "abandono",
      sala
    }
    io.to(sala.name).emit('salaAbandonada', data)
    await salaM.findOneAndDelete({ name: salaX.name })
    //console.log("sala eliminada")
    return
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
      sala.cantosenmano.boolTruco = false
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
  sala.cantosenmano.faltaRespuesta = true;
  sala.cantosenmano.canto = res.canto;
  sala.cantosenmano.jugador = res.jugador.id
  res.cantosenmano = sala.cantosenmano;
  sala.save();
  return (res)
}

const verificarCantora = async (salaName, userID) => {
  try {
    //Aquí, se obtienen las últimas jugadas de cada jugador.
    //antes que comparen valores me fijo que la ultima jugada de cada uno no sea una carta q no pueden tirar
    let sala = await salaM.findOne({ name: salaName });
    let users = sala.usuarios;
    let idJugador, posicion, ultimaJugada
    if (typeof userID.toHexString === 'function') {
      idJugador = userID.toHexString()
    } else {
      idJugador = userID
    }
    users.forEach(async (element) => {
      if (element.id.toHexString() === idJugador) {
        ultimaJugada = element.jugada[element.jugada.length - 1]
        if (!ultimaJugada) {
          console.log("la ultima jugada del usuario es undefinid")
        }
        posicion = users.indexOf(element);
      }
    })
    if (users[posicion].tieneFlor && !users[posicion].cantoFlor) {
      console.log("tiene flor y no la canto")
      console.log("cantidad de cartas tiradas: ", users[posicion].jugada.length)
      if (users[posicion].jugada.length == 3) {//tenia flor, no la canto y tiro las 3 cartas
        console.log("puntosDevolver: ", sala.cantosenmano.puntosDevolver)
        if (sala.cantosenmano.posGanMentira == posicion) {//si gano el punto el q tenia la flor
          console.log("fue quien gano los puntos de la mentira")
          users[posicion].tantos -= sala.cantosenmano.puntosDevolver; //le resto el puntaje que gano y le sumo los 3 puntos de la cantora al otro
          if (posicion == 0) {//le pongo 3 al otro q no era
            console.log("sumo 3 a ", users[1].name)
            users[1].tantos += 3
          } else {
            users[0].tantos += 3
            console.log("sumo 3 a ", users[0].name)
          }

        } else {//si gano el punto el q no tenia la flor
          console.log("no gano los puntos de la mentira")
          if (posicion == 0) {//le pongo 2 al otro q no era para completar los 3 puntos de la cantora
            users[1].tantos -= sala.cantosenmano.puntosDevolver
            users[1].tantos += 3
            console.log("sumo 3 a ", users[1].name)
            console.log("resto los a devolver a ", users[1].name)
          } else {
            users[0].tantos -= sala.cantosenmano.puntosDevolver
            users[0].tantos += 3
            console.log("sumo 3 a ", users[0].name)
            console.log("resto los a devolver a ", users[0].name)
          }
        }

      } else {
        if (users[posicion].noTirar.length > 0) {//quiere decir que hay cartas que no debe tirar
          console.log("hay cartas q no debe tirar y son: ", users[posicion].noTirar)
        }
      }
    }
    let devolver = await salaM.findOneAndUpdate({ name: salaName }, { $set: { usuarios: users } })
    return devolver



  } catch (err) {
    console.log("error dentro de verificarCantora: ", err)
    return
  }
  // let users = sala.usuarios;
  // let jugador1 = users[0];
  // let jugador2 = users[1];
  // const jugada1 = jugador1.jugada[jugador1.jugada.length - 1]
  // const jugada2 = jugador2.jugada[jugador2.jugada.length - 1]
  /*   
    if (jugador1.tieneFlor && !jugador1.cantoFlor) {//me fijo del jugador1
      if (jugador1.jugada.length == 3) {//antes que comparen valores me fijo que la ultima jugada de cada uno no sea la 3ra y haya negado flor
        console.log("jugo las 3 cartas y habia negado flor el jugador: ", jugador1.name)
      } else {
        if (jugador1.jugada.length < 3) {//si la ultima jugada no es una carta que no podia
          console.log("aca debo verificar q sea valida la carta del jugador: ", jugador1.name)
        }
      }
    }
    if (jugador2.tieneFlor && !jugador2.cantoFlor) {//me fijo del jugador1
      if (jugador2.jugada.length == 3) {//antes que comparen valores me fijo que la ultima jugada de cada uno no sea la 3ra y haya negado flor
        console.log("jugo las 3 cartas y habia negado flor el jugador: ", jugador2.name)
      } else {
        if (jugador2.jugada.length < 3) {//si la ultima jugada no es una carta que no podia
          console.log("aca debo verificar q sea valida la carta del jugador: ", jugador2.name)
        }
      }
    } */
  return
}

//al terminar la partida sumo los tantos deacuerdo a lo cantado y al jugador q ganó
const sumarTantosAPartida = async (salaX, jugador) => {
  let sala = await salaM.findById({ _id: salaX._id });
  if (sala.cantosenmano.boolValeCuatro) {
    //console.log("llegamos al valecuatro")
    sala.usuarios[jugador].tantos += 4;
  } else {
    if (sala.cantosenmano.boolReTruco) {
      //console.log("llegamos al retruco")
      sala.usuarios[jugador].tantos += 3;
    } else {
      if (sala.cantosenmano.boolTruco) {
        //console.log("llegamos al truco")
        sala.usuarios[jugador].tantos += 2;
      } else {
        //console.log("no hubo rabon")
        sala.usuarios[jugador].tantos += 1;
      }
    }
  }
  try {
    await sala.save()
    return
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
        //console.log('empate parda en primera') //ya devuelve avisando que es primera y parda
        return false
      }
      //aca va si tienen el mismo valor pero no es la primera carta, puede ser la segunda o 3ra
      if (jugador2.jugada.length === 2) {//comparo con 1 solo ya que tienen la misma cantidad de jugadas
        if (sala.cantosenmano.pardaPrimera) {
          if (users[0].mano) {
            await sumarTantosAPartida(sala, 0)
            //console.log('Gana ', users[0].name, 'por mano en parda en primera...')
          }
          else {
            await sumarTantosAPartida(sala, 1)
            //console.log('Gana ', users[1].name, 'por mano en parda en primera')

          }
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          return true
        } else {
          if (users[0].ganoPrimera) {
            await sumarTantosAPartida(sala, 0)
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            //console.log('Gana ', users[0].name, 'habia ganado en primera')
            return true
          }
          else {
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            await sumarTantosAPartida(sala, 1)
            //console.log('Gana ', users[1].name, 'habia ganado en primera')
            return true
          }

        }


      } //
      if (jugador2.jugada.length === 3) {//comparo con 1 solo ya que tienen la misma cantidad de jugadas

        if (users[0].ganoPrimera) {
          await sumarTantosAPartida(sala, 0)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          //console.log('Gana ', users[0].name, ' parda ultima carta y habia ganado en primera')
          return true
        }
        else {
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          await sumarTantosAPartida(sala, 1)
          //console.log('Gana ', users[1].name, ' parda ultima carta y habia ganado en primera ')
          return true
        }
      }
    }
    if (jugada1.valor > jugada2.valor) {
      jugador1.juega = true;
      jugador2.juega = false;
      if (jugador2.jugada.length === 1) {
        jugador1.ganoPrimera = true; //si es la primera jugada solo anoto que gano la primera y le vuelve a tocar jugar
        //console.log('Gana ', users[0].name, ' primera jugada ')
        return false
      }
      if (jugador1.jugada.length === 2) { //si es la 2da jugada y ya gano primera termina la ronda y le sumo los puntos de lo cantado
        if (users[0].ganoPrimera || sala.cantosenmano.pardaPrimera) {
          await sumarTantosAPartida(sala, 0)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          //console.log('Gana ', users[0].name, ' segunda jugada  y ya tenia primera')
          return true
        }

        //console.log('Gana ', users[0].name, ' segunda jugada ')
        return false
      }
      if (jugador1.jugada.length === 3) {//si gana en la 3ra le sumo los puntos de lo cantado
        await sumarTantosAPartida(sala, 0)
        await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
        //console.log('Gana ', users[0].name, ' tercera jugada')
        return true
      }

    }
    if (jugada2.valor > jugada1.valor) {
      //Si el valor de la última jugada del jugador 2 es mayor, se incrementa el puntaje del jugador 2 
      //console.log("dentro de comparar valores, jugada 2 mayor q 1")
      jugador1.juega = false;
      jugador2.juega = true;
      if (jugador2.jugada.length === 1) {
        jugador2.ganoPrimera = true;
        //console.log('Gana ', users[1].name, ' primera jugada ')
        return false
      }
      if (jugador2.jugada.length === 2) {

        if (users[1].ganoPrimera || sala.cantosenmano.pardaPrimera) {
          //console.log("dentro de comparar valores, 2da jugada y hubo parda o gano en primera el 2do jugador")

          await sumarTantosAPartida(sala, 1)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          //console.log('Gana ', users[1].name, ' ronda xq habia ganado en primera tambien ')
          return true
        } else {
          //console.log("dentro de comparar valores, 2da jugada y  no hubo parda o ni gano en primera el 2do jugador")

          return false
        }
      }
      if (jugador2.jugada.length === 3) {
        await sumarTantosAPartida(sala, 1)
        await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
        //console.log('Gana ', users[1].name, ' ronda en tercera jugada ')
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
  if (sala.finish) {
    sala.partida += 1
    //console.log("partida terminada")
  }
  let terminoTodo = await juegoFinalizado(sala)
  if (terminoTodo) {



    return true

  } else {
    //console.log('Aun no termina el juego, siga')
    return false
  }

}

const juegoFinalizado = async (salaX) => {
  try {
    let sala = await salaM.findOne({ name: salaX.name })
    let usuarios = sala.usuarios
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
  jugador1.aMostrar = [];
  jugador2.aMostrar = [];
  jugador1.noTirar = [];
  jugador2.noTirar = [];

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
  jugador1.tieneFlor = temp1.flor;
  jugador2.tieneFlor = temp2.flor;
  jugador2.puedeCantar = true;
  jugador1.puedeCantar = true;
  jugador2.puedeMentir = true;
  jugador1.puedeMentir = true;
  jugador2.cantoFlor = false;
  jugador1.cantoFlor = false;
  salaOn.cantosenmano.puntosDevolver = 0;
  salaOn.cantosenmano.posGanMentira = 10;
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
  salaOn.cantosenmano.faltaRespuesta = false;

  salaOn.finish = false;
  salaOn.cantosenmano.pardaPrimera = false;
  if (users[0].mano) {
    users[1].mano = true;
    users[0].mano = false;
    users[1].juega = true;
    users[0].juega = false;

  } else {
    users[0].mano = true;
    users[1].mano = false;
    users[0].juega = true;
    users[1].juega = false;

  }
  salaOn.save();

  //Una vez que se actualiza, se busca la sala (la acción anterior me devuelve la sala sin actualizar, por eso este paso adicional) y se devuelve a travez del emit 'repartir'

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




