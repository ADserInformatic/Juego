const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
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
const server = http.createServer(app);


//Conexión con socketIo, cambiar el localhos por el dominio del front.
const socketIo = require('socket.io');
const admin = require('./modelos/admin');
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:8100', 'https://invierteygana.com.ar', 'https://back.invierteygana.com.ar'
      , 'http://back.invierteygana.com.ar', 'http://localhost:3006'
    ],
    /* methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['my-custom-header'],
    credentials: true */
  }
  // // , transports: ['websocket'] // Esto fuerza el uso de WebSocket en el servidor
});

server.listen(process.env.PORT || 3006, () => {
  console.log('Server is running on port 3006');
});
//Rutas
app.use('/', user)
app.use('/sala', sala)
app.use('/carta', carta)

// Maneja todas las rutas no definidas y redirige a index.html
const path = require('path');


// Sirve los archivos estáticos de la aplicación Angular

app.use(express.static(path.join(__dirname, '../public_html')));


// Maneja todas las rutas no definidas y redirige a index.html

app.get('*', (req, res) => {

  res.sendFile(path.join(__dirname, '../public_html/index.html'));

});

/* 
app.get('/', (req, res) => {
  const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Página de Ejemplo</title>
      </head>
      <body>
          <h1>Hola, bienvenido a mi API!</h1>
          <p>Este es un ejemplo de cómo mostrar HTML desde una API de Node.js.</p>
      </body>
      </html>
  `;
  res.send(htmlContent); // Enviar el contenido HTML como respuesta
}); */


//Wwbsocket
//En qué momento se hace la conexión lo manejo desde el front
io.on('connection', (socket) => {
  socket.on('sala', async (id) => {
    try {
      let datos

      if (!id) {

        datos = {
          error: true,
          sala: "",
          mensaje: `Error al procesar la solicitud`
        };
        socket.emit('sala', datos);
        return
      }
      const sala = await salaM.findOne({ _id: id })
      if (!sala) {
        datos = {
          error: true,
          sala: "",
          mensaje: `Error al procesar la solicitud`
        };
        socket.emit('sala', datos);
        return
      }
      socket.join(sala.name)
      //Lo que está entre parentesis limita los usuarios a los que emito. En este los usuarios que esten en la sala con el mismo nombre.
      //La diferencia entre io.to y socket.to es que, en el primer caso se emite para todos los usuarios que están dentro de la sala. En el siguiente caso se obvia a quien hizo la petición al back
      datos = {
        error: false,
        sala: sala,
        mensaje: `Solicitud procesada con exito`
      };
      io.to(sala.name).emit('sala', datos)
      if (sala.usuarios.length == 2) {
        if ((sala.usuarios[0].valores.length == 0 && sala.usuarios[1].valores.length == 0) || (!sala.usuarios[0].valores && !sala.usuarios[1].valores)) {
          await repartir(sala) // Inicializar el tiempo de cada jugador
          iniciarMostrarTiempo(sala.name, 1000)
        }
      }
    }
    catch (err) {
      console.log("error dentro de la sockenOn sala, error al crear sala o unirse y el mensaje de error es: ", err.message)
      datos = {
        error: true,
        sala: "",
        mensaje: `Error al procesar la solicitud`
      };
      socket.emit('sala', datos);
      return

    }
  })

  //Con socket.io se utiliza emit para emitir una acción y on para escuchar esa acción, lo que debe coinsidir es el nombre que va entre comillas
  //Se escucha la acción 'repartir' y se ejecuta la siguiente función
  socket.on('repartir', async (_sala) => {
    try {
      //Se recibe la sala para la que hay que repartir y se busca en la base de datos
      const salaOn = await salaM.findOne({ _id: _sala._id })
      await repartir(_sala)
      //vuelve a false los booleanos de cantos

      const salaActualizada = await salaM.findOne({ _id: salaOn._id })
      io.to(salaOn.name).emit('repartir', salaActualizada)
    } catch (err) {
      console.log("error dentro de sockenOn repartir y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }
  })

  //Cada vez que un usuario tira (presiona) una carta, se ejecuta esta acción
  socket.on('tirar', async (jugada) => {
    try {
      //LLega un objeto con los datos de la jugada (sala, id del usuario y valor jugado)
      //Se busca la sala en la que se está jugando a partir del nombre
      const salaOn = await salaM.findOne({ name: jugada.sala })
      //Se guarda los usuarios que están jugando en esa sala en un array
      let users = salaOn.usuarios
      users[0].timeJugada = 60;
      users[1].timeJugada = 60;
      users[0].debeResponder = false;
      users[1].debeResponder = false;
      users[0].realizoCanto = false;
      users[1].realizoCanto = false;


      let idUltimoTiro;
      users.forEach(async (element) => {
        //Recorro los usuarios en esa sala y al que coincide con el id del que hizo la jugada se le actualizan los datos
        if (jugada.idUser === element.id.toHexString()) {
          element.tiempoAgotado = 0;
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
      //Una vez actualizado el usuario se actualiza la sala
      await salaM.findByIdAndUpdate({ _id: salaOn._id }, { $set: { usuarios: users } })
      //Una vez actualizada la sala se vuelve a buscar para devolverla al front (el update no devuelve el objeto actualizado, por eso este paso extra)
      const salaCasiActualizada = await verificarCantora(salaOn.name, idUltimoTiro);
      io.to(salaOn.name).emit('muestra', salaCasiActualizada) //muestra la ultima carta tirada, 

      //Una vez hecho todo esto se emite hacia el front la sala con los nuevos datos

      //La función terminar determina si una partida entre dos jugadores ha terminado basándose en el número de jugadas realizadas y declara al ganador
      if (terminoMano) { //si terminó la mano
        //SI TERMINO LA MANO PREGUNTO SI TERMINO EL JUEGO
        let terminoJuego = await terminar(salaOn) //vuelve a repartir y suma partidas pero si ya termino el juego devuelve true o false
        if (!terminoJuego) { //si el resultado de la funcion terminar es falso, se sigue el juego y se reparte, solo termino una mano
          const mostrarPuntos = await salaM.findOne({ name: salaOn.name })
          if (mostrarPuntos.cantosenmano.mostrarPuntos) {
            let ganador = mostrarPuntos.cantosenmano.posGanMentira
            mostrarPuntos.usuarios[ganador].cartasAMostrar.forEach(element => {
              let tirada = mostrarPuntos.usuarios[ganador].jugada.find(e => e.carta === element.name)
              if (!tirada) {
                let cartaParaAgregar = {
                  sala: mostrarPuntos.name,
                  valor: element.valor,
                  carta: element.name,
                  idUser: mostrarPuntos.usuarios[ganador].id.toHexString()
                }
                mostrarPuntos.usuarios[ganador].jugada.push(cartaParaAgregar)
              }
            })
            await mostrarPuntos.save()
          }
          setTimeout(() => {
            io.to(salaOn.name).emit('muestra', mostrarPuntos)
          }, 2000); //reparte a los 5 segundos
          setTimeout(() => {
            repartir(mostrarPuntos)
          }, 5000); //reparte a los 5 segundos
        } else {
          let winner;
          if (users[0].tantos > users[1].tantos) {
            winner = users[0].id
          } else {
            winner = users[1].id
          }
          await juegoTerminado(salaOn, winner)
        }
      } else {

        let salaActualizada = await salaM.findOne({ _id: salaOn._id })
        if (salaCasiActualizada) {
          io.to(salaOn.name).emit('muestra', salaCasiActualizada) //muestra la ultima carta tirada, 
        } else {
          io.to(salaOn.name).emit('muestra', salaActualizada) //muestra la ultima carta tirada, 
        }
      }
    } catch (err) {
      console.log("error dentro de sockenOn tirar y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }
  }
  )

  //Cuando un jugador canta (envido, flor o truco), se emite al otro jugador el canto y, en caso de requerirse, se espera una respuesta.
  socket.on('canto', async (res) => {
    try {

      let ores = await booleanos(res);
      const sala = await salaM.findOne({ name: res.sala });
      sala.usuarios[0].timeJugada = 60;//ambos usuarios inician con 60 seg por movimiento o respuesta
      sala.usuarios[1].timeJugada = 60;//ambos usuarios inician con 60 seg por movimiento o respuesta
      sala.usuarios.forEach(element => {
        if (element.id.toHexString() === res.jugador.id) {
          element.tiempoAgotado = 0 //vuelvo a cero contador de tiempo agotado xq no tuvo 2 seguidos
          element.realizoCanto = true//coloco que es el usuario quien realiza el canto
          element.debeResponder = false//y pogo que si debia responder ya lo hizo
        } else {
          element.realizoCanto = false//si no es el usuario que canto, pongo q realizo canto en false
          element.debeResponder = true//si no es el usuario que canto, pongo q debe respondere en true
        }
      })

      let corregir = false;
      let idAcorregir;
      if (res.canto == 'envido' || res.canto == 'reenvido' || res.canto == 'realEnvido' || res.canto == 'faltaEnvido' || res.canto == 'flor') {
        if (sala.cantosenmano.boolTruco) { // si estaba cantado el truco ejecuta el if
          sala.cantosenmano.boolTruco = false; // vuelvo a poner booltruco en false
          sala.usuarios.forEach(element => {
            element.puedeCantar = true
          })
        }
        if (res.canto == 'envido' || res.canto == 'reenvido' || res.canto == 'realEnvido' || res.canto == 'faltaEnvido') { //si el q canta es quien tiene cantora, aun no lo permite el front
          sala.usuarios.forEach(element => {
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
          sala.usuarios.forEach(element => {
            if (element.id === res.jugador.id) {
              if (element.tieneFlor) {
                console.log("canto flor ")
                element.puedeFlor = false;
                element.cantoFlor = true;
              }

            }
          })
        }
      }
      await sala.save()

      if (corregir) {
        await corregirPuntos(idAcorregir, res.sala)
      }
      let actualizar = await salaM.findOne({ name: res.sala })
      ores.cantosenmano = actualizar.cantosenmano;
      actualizar.usuarios.forEach(element => {
        if (ores.jugador.name == element.name) {
          ores.jugador == element
        }
      })
      socket.to(res.sala).emit('cantando', ores)
    } catch (err) {
      console.log("error dentro de socketOn canto y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }
  })

  //Esto está recibiendo tanto envido como truco y flor. ¡Tener eso en cuenta!
  socket.on('respuestaCanto', async (res) => {
    try {
      let sala = await salaM.findOne({ name: res.sala })
      let users = sala.usuarios
      sala.cantosenmano.faltaRespuesta = true;
      sala.usuarios[0].timeJugada = 60;
      sala.usuarios[1].timeJugada = 60;
      sala.usuarios.forEach(element => {
        if (element.id.toHexString() === res.jugador.id) {
          element.tiempoAgotado = 0
          element.debeResponder = false
          if (res.respuesta == "quiero" || res.respuesta == "noquiero" || res.respuesta == "aceptar") {
            element.realizoCanto = false
          } else {
            element.realizoCanto = true
          }

        } else {
          if (res.respuesta == "quiero" || res.respuesta == "noquiero" || res.respuesta == "aceptar") {
            element.debeResponder = false
            element.realizoCanto = false
          } else {
            element.debeResponder = true
            element.realizoCanto = false
          }
        }
      })
      await sala.save()
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
                sala.cantosenmano.mostrarPuntos = true;
                //Acá paso los usuarios a la función que calcula los puntos
                if (users[0].puntosMentira > users[1].puntosMentira) {
                  users[0].tantos += 2
                  sala.cantosenmano.posGanMentira = 0;
                  mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
                  winner = users[0].id
                  sala.cantosenmano.posGanMentira = 0;


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
                await sala.save()
                await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
                terminado = await terminar(sala)
                if (terminado) {
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
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
        case 'reEnvido':
          switch (res.respuesta) {
            case 'quiero':
              sala.cantosenmano.faltaRespuesta = false;
              sala.cantosenmano.puntosDevolver = 4;
              sala.cantosenmano.mostrarPuntos = true;

              if (users[0].puntosMentira > users[1].puntosMentira) {
                sala.cantosenmano.posGanMentira = 0;
                users[0].tantos += 4
                winner = users[0].id
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              }
              if (users[0].puntosMentira < users[1].puntosMentira) {
                sala.cantosenmano.posGanMentira = 1
                users[1].tantos += 4
                winner = users[1].id
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              }
              if (users[0].puntosMentira == users[1].puntosMentira) {
                if (users[1].mano == true) {
                  sala.cantosenmano.posGanMentira = 1
                  users[1].tantos += 4;
                  winner = users[1].id
                  mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
                } else {
                  sala.cantosenmano.posGanMentira = 0
                  winner = users[0].id
                  users[0].tantos += 4;
                  mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
                }
              }
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
              sala.cantosenmano.puntosDevolver = 2;

              users.forEach(us => {
                if (us.name != res.jugador.name) {
                  sala.cantosenmano.posGanMentira = users.indexOf(us);

                  us.tantos += 2
                  winner = us.id

                } else {
                  mensaje = `${us.name} no quiere`
                }
              })
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
              sala.cantosenmano.mostrarPuntos = true;
              if (users[0].puntosMentira > users[1].puntosMentira) {
                if (sala.cantosenmano.boolReEnvido) {
                  sala.cantosenmano.puntosDevolver = 7;
                  users[0].tantos += 7
                } //se cantó envido envido realenvido
                else {
                  if (sala.cantosenmano.boolEnvido) {
                    sala.cantosenmano.puntosDevolver = 5;
                    users[0].tantos += 5
                  } //se canto envido realenvido
                  else {
                    sala.cantosenmano.puntosDevolver = 3;
                    users[0].tantos += 3
                  } //solo se cantó real envido
                }
                sala.cantosenmano.posGanMentira = 0
                winner = users[0].id
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
              }
              if (users[0].puntosMentira < users[1].puntosMentira) {
                sala.cantosenmano.posGanMentira = 1
                if (sala.cantosenmano.boolReEnvido) {
                  sala.cantosenmano.puntosDevolver = 7;
                  users[1].tantos += 7
                } //se cantó envido envido realenvido
                else {
                  if (sala.cantosenmano.boolEnvido) {
                    sala.cantosenmano.puntosDevolver = 5;
                    users[1].tantos += 5
                  } //se canto envido realenvido
                  else {
                    sala.cantosenmano.puntosDevolver = 3;
                    users[1].tantos += 3
                  }
                }//solo se cantó real envido}
                winner = users[1].id
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
              }
              if (users[0].puntosMentira == users[1].puntosMentira) {
                if (users[0].mano) { //gana usuario 0 de mano
                  sala.cantosenmano.posGanMentira = 0
                  if (sala.cantosenmano.boolReEnvido) {
                    sala.cantosenmano.puntosDevolver = 7;
                    users[0].tantos += 7
                  } //se cantó envido envido realenvido
                  else {
                    if (sala.cantosenmano.boolEnvido) {
                      sala.cantosenmano.puntosDevolver = 5;
                      users[0].tantos += 5
                    } //se canto envido realenvido
                    else {
                      sala.cantosenmano.puntosDevolver = 3;
                      users[0].tantos += 3
                    }
                  }//solo se cantó real envido}
                  winner = users[0].id
                  mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
                } else {
                  sala.cantosenmano.posGanMentira = 1
                  //gana usuario 1 de mano
                  if (sala.cantosenmano.boolReEnvido) {
                    sala.cantosenmano.puntosDevolver = 7;
                    users[1].tantos += 7
                  } //se cantó envido envido realenvido
                  else {
                    if (sala.cantosenmano.boolEnvido) {
                      sala.cantosenmano.puntosDevolver = 5;
                      users[1].tantos += 5
                    } //se canto envido realenvido
                    else {
                      sala.cantosenmano.puntosDevolver = 3;
                      users[1].tantos += 3
                    }
                  }//solo se cantó real envido}
                  winner = users[1].id
                  mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                }
              }
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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

              users.forEach(us => {
                if (us.name != res.jugador.name) {
                  sala.cantosenmano.posGanMentira = users.indexOf(us)
                  winner = us.id
                  if (sala.cantosenmano.boolReEnvido) {
                    sala.cantosenmano.puntosDevolver = 4;
                    us.tantos += 4
                  } //se cantó envido envido realenvido
                  else {
                    if (sala.cantosenmano.boolEnvido) {
                      sala.cantosenmano.puntosDevolver = 2;
                      us.tantos += 2
                    } //se canto envido realenvido
                    else {
                      sala.cantosenmano.puntosDevolver = 1;
                      us.tantos += 1
                    }
                  }//solo se cantó real envido
                } else {
                  mensaje = `${us.name} no quiere`
                }
              })
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
              sala.cantosenmano.mostrarPuntos = true;
              sala.cantosenmano.faltaRespuesta = false;
              if (users[0].puntosMentira > users[1].puntosMentira) {
                sala.cantosenmano.posGanMentira = 0
                winner = users[0].id
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
                if (sala.unaFalta) {
                  users[0].tantos += 30 - users[1].tantos;
                } else {
                  if (user[1].tantos < 15) {
                    sala.cantosenmano.puntosDevolver = 15 - users[1].tantos;

                    users[0].tantos += 15 - users[1].tantos;
                  }
                  else {
                    sala.cantosenmano.puntosDevolver = 30 - users[1].tantos;
                    users[0].tantos += 30 - users[1].tantos;
                  }
                }

              } else {
                if (users[1].puntosMentira > users[0].puntosMentira) {
                  sala.cantosenmano.posGanMentira = 1
                  mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                  winner = users[1].id
                  if (sala.unaFalta) {
                    users[1].tantos += 30 - users[0].tantos;
                  } else {
                    if (user[0].tantos < 15) {
                      sala.cantosenmano.puntosDevolver = 15 - users[0].tantos;
                      users[1].tantos += 15 - users[0].tantos;
                    }
                    else {
                      sala.cantosenmano.puntosDevolver = 30 - users[0].tantos;
                      users[1].tantos += 30 - users[0].tantos;
                    }
                  }
                }
                else {
                  if (users[0].puntosMentira == users[1].puntosMentira) {
                    if (users[0].mano) {
                      sala.cantosenmano.posGanMentira = 0
                      mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos POR MANO`
                      winner = users[0].id
                      if (sala.unaFalta) {
                        users[0].tantos += 30 - users[1].tantos;
                      } else {
                        if (user[1].tantos < 15) {
                          sala.cantosenmano.puntosDevolver = 15 - users[1].tantos;
                          users[0].tantos += 15 - users[1].tantos;
                        }
                        else {
                          sala.cantosenmano.puntosDevolver = 30 - users[1].tantos;
                          users[0].tantos += 30 - users[1].tantos;
                        }
                      }
                    } else {
                      sala.cantosenmano.posGanMentira = 1
                      mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos POR MANO`
                      winner = users[1].id
                      if (sala.unaFalta) {
                        users[1].tantos += 30 - users[0].tantos;
                      } else {
                        if (user[0].tantos < 15) {
                          sala.cantosenmano.puntosDevolver = 15 - users[0].tantos;
                          users[1].tantos += 15 - users[0].tantos;
                        }
                        else {
                          sala.cantosenmano.puntosDevolver = 30 - users[0].tantos;
                          users[1].tantos += 30 - users[0].tantos;
                        }
                      }
                    }
                  }

                }

              }
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
              users.forEach(us => {
                if (us.name != res.jugador.name) {
                  sala.cantosenmano.posGanMentira = users.indexOf(us)
                  winner = us.id
                  if (sala.cantosenmano.boolRealEnvido) {
                    if (sala.cantosenmano.boolReEnvido) {
                      if (sala.cantosenmano.boolEnvido) {
                        us.tantos += 7
                        sala.cantosenmano.puntosDevolver = 7
                      } //se canto envido realenvido y dsp la falta
                      else {
                        us.tantos += 3
                        sala.cantosenmano.puntosDevolver = 3
                      } //se canto solo real envido y dsp la falta
                    } //se cantó envido envido realenvido y dsp la falta
                    else {
                      if (sala.cantosenmano.boolEnvido) {
                        sala.cantosenmano.puntosDevolver = 5
                        us.tantos += 5
                      } //se canto envido realenvido y dsp la falta
                      else {
                        sala.cantosenmano.puntosDevolver = 3
                        us.tantos += 3
                      } //se canto solo real envido y dsp la falta
                    }
                  }
                  else {
                    if (sala.cantosenmano.boolReEnvido) {
                      sala.cantosenmano.puntosDevolver = 4
                      us.tantos += 4
                    } //se canto envido reenvido y dsp la falta
                    else {
                      if (sala.cantosenmano.boolEnvido) {
                        sala.cantosenmano.puntosDevolver = 2
                        us.tantos += 2
                      } //se canto envido y dsp la falta
                      else {
                        sala.cantosenmano.puntosDevolver = 1
                        us.tantos += 1  //solo se canto la falta
                      }
                    }
                  }
                } else { mensaje = `${us.name} no quiere` }
                //solo se cantó real envido
              })
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
        case 'truco':
          switch (res.respuesta) {
            case 'quiero':
              sala.cantosenmano.faltaRespuesta = false;
              await sala.save()
              mensaje = `${res.jugador.name} dice: ${res.respuesta}`
              datos = { mensaje, jugador: res.jugador, sala }

              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              io.to(res.sala).emit('resultadoDeCanto', datos)
              break;  //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
            case 'noquiero':
              sala.cantosenmano.faltaRespuesta = false;
              mensaje = `${res.jugador.name} dice: ${res.respuesta}...Repartiendo`
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
                await juegoTerminado(sala, winner)

              } else {
                datos = {
                  mensaje,
                  jugador: res.jugador,
                  sala
                }
                io.to(res.sala).emit('resultadoDeCanto', datos)
                if (sala.finish) {
                  await terminar(sala)
                  setTimeout(() => {
                    repartir(sala)
                  }, 4000); //reparte a los 5 segundos
                }
              }

              break;
            default:
              res.canto = res.respuesta;
              res = await booleanos(res);
              socket.to(res.sala).emit('cantando', res)
              break;
          }
          break;
        case 'reTruco':
          switch (res.respuesta) {
            case 'quiero':
              sala.cantosenmano.faltaRespuesta = false;
              await sala.save()
              mensaje = `${res.jugador.name} dice: ${res.respuesta}`
              datos = { mensaje, jugador: res.jugador, sala }
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              io.to(res.sala).emit('resultadoDeCanto', datos)
              break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
            case 'noquiero':
              sala.cantosenmano.faltaRespuesta.bool = false;
              mensaje = `${res.jugador.name} dice: ${res.respuesta}...Repartiendo`
              users.forEach(element => {
                if (element.id != res.jugador.id) {
                  element.tantos += 2;
                  winner = element.id
                }
              })
              sala.finish = true;
              await sala.save();
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
                await juegoTerminado(sala, winner)

              } else {
                datos = {
                  mensaje,
                  jugador: res.jugador,
                  sala
                }
                io.to(res.sala).emit('resultadoDeCanto', datos)
                if (sala.finish) {
                  await terminar(sala)
                  setTimeout(() => {
                    repartir(sala)
                  }, 5000); //reparte a los 5 segundos
                }
              }





              break;
            default:
              res.canto = res.respuesta;
              res = await booleanos(res);
              socket.to(res.sala).emit('cantando', res)
              break;
          }

          break;
        case 'valeCuatro':
          switch (res.respuesta) {
            case 'quiero':
              sala.cantosenmano.faltaRespuesta = false;
              await sala.save()
              mensaje = `${res.jugador.name} dice: ${res.respuesta}`
              datos = { mensaje, jugador: res.jugador, sala }

              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

              io.to(res.sala).emit('resultadoDeCanto', datos)
              break; //CONTINUAR TIRANDO CARTAS Y COMPARAR PARA ASIGNAR EL VALOR
            case 'noquiero':
              sala.cantosenmano.faltaRespuesta = false;
              mensaje = `${res.jugador.name} dice: ${res.respuesta}...Repartiendo`
              users.forEach(element => {
                if (element.id != res.jugador.id) {
                  element.tantos += 3;
                  winner = element.id
                }
              })
              sala.finish = true;
              await sala.save();
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

              terminado = await terminar(sala)
              if (terminado) {
                await juegoTerminado(sala, winner)

              } else {

                datos = {
                  mensaje,
                  jugador: res.jugador,
                  sala
                }
                io.to(res.sala).emit('resultadoDeCanto', datos)

                if (sala.finish) {
                  await terminar(sala)
                  setTimeout(() => {
                    repartir(sala)
                  }, 5000); //reparte a los 5 segundos
                }
              }
              break;
          }
          break;
        case 'flor':
          switch (res.respuesta) {
            case 'aceptar':
              sala.cantosenmano.mostrarPuntos = true;
              mensaje = ""
              sala.cantosenmano.faltaRespuesta = false;
              users.forEach(element => {
                if (element.name != res.jugador.name) {
                  sala.cantosenmano.posGanMentira = users.indexOf(element)
                  sala.cantosenmano.puntosDevolver = 3
                  element.tantos += 3;
                  winner = element.id
                }
              })
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
              io.to(res.sala).emit('cantando', res)
              break;
          }

          break;
        case 'florFlor':
          switch (res.respuesta) {
            case 'quiero':
              sala.cantosenmano.mostrarPuntos = true;
              sala.cantosenmano.faltaRespuesta = false;
              sala.cantosenmano.puntosDevolver = 6
              if (users[0].puntosMentira > users[1].puntosMentira) {
                users[0].tantos += 6
                winner = users[0].id
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
                sala.cantosenmano.posGanMentira = 0
              }
              if (users[0].puntosMentira < users[1].puntosMentira) {
                users[1].tantos += 6
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                winner = users[1].id
                sala.cantosenmano.posGanMentira = 1
              }
              if (users[0].puntosMentira == users[1].puntosMentira) {
                if (users[1].mano == true) {
                  winner = users[1].id
                  users[1].tantos += 6;
                  mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
                  sala.cantosenmano.posGanMentira = 1
                } else {
                  winner = users[0].id
                  users[0].tantos += 6;
                  mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
                  sala.cantosenmano.posGanMentira = 0
                }
              }
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
            case 'noquiero':
              sala.cantosenmano.mostrarPuntos = true;
              sala.cantosenmano.faltaRespuesta = false;

              users.forEach(element => {
                if (element.id != res.jugador.id) {
                  sala.cantosenmano.posGanMentira = users.indexOf(element)
                  winner = element.id
                  element.tantos += 4;
                } else {
                  mensaje = mensaje = `${element.name} no quiere`
                }
              })
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
        case 'florMeAchico':
          switch (res.respuesta) {
            case 'aceptar':
              sala.cantosenmano.faltaRespuesta = false;
              sala.cantosenmano.puntosDevolver = 4
              sala.cantosenmano.mostrarPuntos = true;
              users.forEach(us => {
                if (us.name != res.jugador.name) {
                  sala.cantosenmano.posGanMentira = users.indexOf(us)
                  us.tantos += 4
                  winner = us.id
                }
              })
              mensaje = ""
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
        case 'contraFlor':
          switch (res.respuesta) {
            case 'quiero':
              sala.cantosenmano.mostrarPuntos = true;
              sala.cantosenmano.faltaRespuesta = false;
              if (users[0].puntosMentira > users[1].puntosMentira) {
                users[0].tantos += 30
                winner = users[0].id
                mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos`
                sala.cantosenmano.posGanMentira = 0
              }
              if (users[0].puntosMentira < users[1].puntosMentira) {
                users[1].tantos += 30
                winner = users[1].id
                mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos`
                sala.cantosenmano.posGanMentira = 1
              }
              if (users[0].puntosMentira == users[1].puntosMentira) {
                if (users[1].mano == true) {
                  winner = users[1].id
                  users[1].tantos += 30;
                  mensaje = `Gana ${users[1].name} con ${users[1].puntosMentira} puntos por mano`
                  sala.cantosenmano.posGanMentira = 1
                } else {
                  winner = users[0].id
                  users[0].tantos += 30;
                  mensaje = `Gana ${users[0].name} con ${users[0].puntosMentira} puntos por mano`
                  sala.cantosenmano.posGanMentira = 0
                }
              }
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })

              await juegoTerminado(sala, winner)

              break;
            case 'noquiero':
              sala.cantosenmano.faltaRespuesta = false;
              sala.cantosenmano.mostrarPuntos = true;
              users.forEach(us => {
                if (us.name != res.jugador.name) {
                  sala.cantosenmano.posGanMentira = users.indexOf(us)
                  us.tantos += 4
                  winner = us.id
                } else {
                  mensaje = `${us.name} no quiere`
                }
              })
              await sala.save()
              await salaM.findOneAndUpdate({ name: res.sala }, { $set: { usuarios: users } })
              terminado = await terminar(sala)
              if (terminado) {
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
    } catch (err) {
      console.log("error dentro de sockenOn respuestaCanto y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }
  }
  )

  //ESTA FUNCION ES PARA CUANDO UN USUARIO ABANDONA CLICKEANDO LA OPCION DE ABANDONAR
  socket.on('abandonarSala', async (res) => {
    try {
      const sala = await salaM.findOne({ name: res.sala })
      let usuarioAbandono; //lo guardo por las dudas pero no lo utilizo al final
      if (!sala) {
        return {
          error: true,
          data: "",
          mensaje: "no se encuentra la sala"
        }
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
      console.log("error dentro de sockenOn abandonarSala y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }
  })

  //esta función es para cuando uno se va al mazo, recibe un res con la sala y el jugador q abandono
  socket.on('meVoyAlMazo', async (res) => {
    try {
      const sala = await salaM.findOne({ name: res.sala })
      let idAlMazo;
      let seSuma = false
      if (typeof res.jugador.id.toHexString === 'function') {
        idAlMazo = res.jugador.id.toHexString()
      } else {
        idAlMazo = res.jugador.id
      }
      let posGanador, posAlMazo
      //capturo los usuarios que estan en esa sala
      const users = sala.usuarios
      users[0].timeJugada = 60;
      users[1].timeJugada = 60;
      users.forEach(async (element, index) => {
        //el usuario con el id distinto de quien abandona gana la apuesta
        if (idAlMazo != element.id.toHexString()) {
          posGanador = index
        } else {
          posAlMazo = index
        }
      })
      if (users[posAlMazo].mano) {
        if (users[posAlMazo].puedeMentir && sala.cantosenmano.puntosDevolver == 0 && users[posGanador].jugada.length == 0) {//QUIERE DECIR Q EL Q ABANDONA ES MANO Y NO MINTIO  ni tiro cartas ASI Q SUMA 1 PUNTO AL GANADOR Y MIRO RABONES
          seSuma = true
        }
      }
      await sumarTantosAPartida(sala, posGanador)

      const mostrarPuntos = await salaM.findOne({ name: res.sala })
      mostrarPuntos.rivalAlMazo = true;
      mostrarPuntos.finish = true;
      if (seSuma) {
        mostrarPuntos.usuarios[posGanador].tantos += 1
      }
      if (mostrarPuntos.cantosenmano.mostrarPuntos) {
        let ganador = mostrarPuntos.cantosenmano.posGanMentira
        mostrarPuntos.usuarios[ganador].cartasAMostrar.forEach(element => {
          let tirada = mostrarPuntos.usuarios[ganador].jugada.find(e => e.carta === element.name)
          if (!tirada) {
            let cartaParaAgregar = {
              sala: mostrarPuntos.name,
              valor: element.valor,
              carta: element.name,
              idUser: mostrarPuntos.usuarios[ganador].id.toHexString()
            }
            mostrarPuntos.usuarios[ganador].jugada.push(cartaParaAgregar)
          }
        })
        await mostrarPuntos.save()
      }
      setTimeout(() => {
        io.to(res.sala).emit('muestra', mostrarPuntos)
      }, 2000); //reparte a los 5 segundos


      let terminoJuego = await terminar(mostrarPuntos) //vuelve a repartir y suma partidas pero si ya termino el juego devuelve true o false
      if (!terminoJuego) { //si el resultado de la funcion terminar es falso, se sigue el juego y se reparte, solo termino una mano
        setTimeout(() => {
          repartir(mostrarPuntos)
        }, 5000); //reparte a los 5 segundos
      } else {
        let winner;
        if (users[0].tantos > users[1].tantos) {
          winner = users[0].id
        } else {
          winner = users[1].id
        }
        await juegoTerminado(mostrarPuntos, winner)
      }
    } catch (err) {
      console.log("error dentro de sockenOn meVoyAlMazo y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }
  })

  //para cuando el jugador quiere mostrarle al otro cuales eran las cartas que le quedaban por jugar, 
  // recibe req={name: nombre de sala, idJugador: id del jugador que quiere mostrar}
  socket.on('mostrarQueMeQuedaba', async (req, res) => {
    try {
      const sala = await salaM.findOne({ name: res.name })
      let idQuiereMostrar
      if (typeof res.idJugador.toHexString === 'function') {
        idQuiereMostrar = res.idJugador.toHexString()
      } else {
        idQuiereMostrar = res.idJugador
      }
      sala.usuarios.forEach(async (element) => {
        //el usuario con el id distinto de quien abandona gana la apuesta
        if (idQuiereMostrar == element.id.toHexString()) {
          element.cartasAMostrar.forEach(carta => {
            let tirada = element.jugada.find(e => e.carta === carta.name)
            if (!tirada) {
              let cartaParaAgregar = {
                sala: sala.name,
                valor: carta.valor,
                carta: carta.name,
                idUser: element.id.toHexString()
              }
              element.jugada.push(cartaParaAgregar)
            }
          })
        }
      })
      await sala.save()
      return
    } catch (err) {
      console.log("error dentro de sockenOn mostrarQueMeQuedaba y el mensaje de error es: ", err.message)
      return {
        error: true,
        data: "",
        mensaje: `Error al procesar la solicitud: ${err.message}`
      }
    }

  })

});

function iniciarMostrarTiempo(nameSala, intervalo) {
  try {
    const ejecutarMostrarTiempo = async () => {
      let loop = await MostrarTiempo(nameSala);
      if (loop) {
        setTimeout(ejecutarMostrarTiempo, intervalo)
      }
    }
    ejecutarMostrarTiempo();
  } catch (err) {
    ejecutarMostrarTiempo();
    return
  }
}

async function MostrarTiempo(nameSala) {
  try {
    const sala = await salaM.findOne({ name: nameSala })
    if (!sala) {
      return false
    }
    let idGanador, idAusente
    let terminarTodo = false;
    let terminarMano = false
    sala.usuarios.forEach((element) => {
      if ((element.juega && !element.realizoCanto && !element.debeResponder) || (element.debeResponder)) {
        idAusente = element.id
        element.timeJugada -= 1;
        if (element.timeJugada <= 30 && element.timeJugada > 0) {
          io.to(sala.name).emit('time', element.timeJugada)
        } else {
          if (element.timeJugada == 0) {
            if (element.tiempoAgotado == 0) {
              element.tiempoAgotado = 1;
              terminarMano = true;

            } else {
              if (element.tiempoAgotado == 1) {
                terminarTodo = true;
                //el jugador perdio por abandono de sala
              }
            }
          }
        }
      } else {
        idGanador = element.id
      }
    })
    await sala.save()
    if (terminarTodo) {
      await juegoTerminado(sala, idGanador);
      return false
    } else {
      if (terminarMano) {
        try {
          let idAlMazo;
          let seSuma = false
          if (typeof idAusente.toHexString === 'function') {
            idAlMazo = idAusente.toHexString()
          } else {
            idAlMazo = idAusente
          }
          let posGanador, posAlMazo
          //capturo los usuarios que estan en esa sala
          sala.usuarios.forEach(async (element, index) => {
            //el usuario con el id distinto de quien abandona gana la apuesta
            if (idAlMazo != element.id.toHexString()) {
              posGanador = index
            } else {
              posAlMazo = index
            }
          })
          if (sala.usuarios[posAlMazo].mano) {
            if (sala.usuarios[posAlMazo].puedeMentir && sala.cantosenmano.puntosDevolver == 0 && sala.usuarios[posGanador].jugada.length == 0) {//QUIERE DECIR Q EL Q ABANDONA ES MANO Y NO MINTIO  ni tiro cartas ASI Q SUMA 1 PUNTO AL GANADOR Y MIRO RABONES
              seSuma = true
            }
          }

          await sumarTantosAPartida(sala, posGanador)

          let mostrar = await salaM.findOne({ name: nameSala })
          mostrar.usuarios.timeJugada = 60;
          mostrar.usuarios.timeJugada = 60;
          mostrar.rivalAusente = true
          mostrar.finish = true;
          if (seSuma) {
            mostrar.usuarios[posGanador].tantos += 1
          }
          await mostrar.save()
          io.to(sala.name).emit('muestra', mostrar)

          let terminoJuego = await terminar(mostrar) //vuelve a repartir y suma partidas pero si ya termino el juego devuelve true o false
          if (!terminoJuego) { //si el resultado de la funcion terminar es falso, se sigue el juego y se reparte, solo termino una mano
            setTimeout(() => {
              repartir(mostrar)
            }, 3000); //reparte a los 5 segundos
            return true
          } else {
            try {
              let winner;
              if (mostrar.usuarios[0].tantos > mostrar.usuarios[1].tantos) {
                winner = mostrar.usuarios[0].id
              } else {
                winner = mostrar.usuarios[1].id
              }

              await juegoTerminado(salaOn, winner)
              return false
            } catch (err) {
              console.log("error en destruir sala, el error es : ", err)
              return false
            }
          }
        } catch (err) {
          console.log("error dentro de terminar mano y el error es: ", err)
          return false
        }
      }
      return true
    }
  } catch (err) {
    console.log("error dentro de funcion MostrarTiempo y el mensaje de error es: ", err.message)
    iniciarMostrarTiempo(nameSala, 1000)
    return false
  }
}

//corrijo puntos si tenia flor y no la canto para mentir o aceptar mentira
const corregirPuntos = async (idLLega, nameSala) => {
  try {
    const sala = await salaM.findOne({ name: nameSala });
    if (sala.cantosenmano.boolFlor || sala.cantosenmano.boolFlorFlor || sala.cantosenmano.boolContraFlor || sala.cantosenmano.boolFlorMeAchico) {
      sala.cantosenmano.florNegada = false;
      return
    }
    sala.cantosenmano.florNegada = true;
    let idJugador;
    if (typeof idLLega.toHexString === 'function') {
      idJugador = idLLega.toHexString()
    } else {
      idJugador = idLLega
    }
    sala.usuarios.forEach(element => {
      if (element.id.toHexString() === idJugador) {
        element.cantoFlor = false;
        let todoMenor = true
        let minimo = parseInt(element.valores[0].name)
        //let cartaNegada = element.valores[0]
        element.valores.forEach(carta => { //al terminar obtengo en todoMenor si debo restar el minimo y corrijo puntaje
          let num = parseInt(carta.name)
          if (num > 7) {
            todoMenor = false;
          }
          if (num < minimo) {
            //cartaNegada = carta
            minimo = num
          }
        })
        //element.noTirar.push(cartaNegada)
        if (todoMenor) {
          element.puntosMentira -= minimo;
        }
      }
    })
    await sala.save()
    return
  } catch (err) {
    console.log("error dentro de funcion corregirPuntos y el mensaje de error es: ", err.message)
    return
  }
}



// Detener el intervalo después de 5 segundos

//ESTA FUNCION ES PARA CUANDO UN USUARIO GANO por lo que sea y debo repartir premio 
const juegoTerminado = async (salaX, idGanador) => { //
  try {
    const sala = await salaM.findOne({ name: salaX.name })
    const users = sala.usuarios
    const admin = await adminA.findOne({})
    let nombreGanador, ganador
    users.forEach(async (element, index) => {
      //entrego premio y guardo ganancia
      if (idGanador.toHexString() === element.id.toHexString()) {
        ganador = index
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
    const mostrarPuntos = await salaM.findOne({ name: salaX.name })
    if (mostrarPuntos.cantosenmano.mostrarPuntos) {
      let ganador = mostrarPuntos.cantosenmano.posGanMentira
      mostrarPuntos.usuarios[ganador].cartasAMostrar.forEach(element => {
        let tirada = mostrarPuntos.usuarios[ganador].jugada.find(e => e.carta === element.name)
        if (!tirada) {
          let cartaParaAgregar = {
            sala: mostrarPuntos.name,
            valor: element.valor,
            carta: element.name,
            idUser: mostrarPuntos.usuarios[ganador].id.toHexString()
          }
          mostrarPuntos.usuarios[ganador].jugada.push(cartaParaAgregar)
        }
      })
      await mostrarPuntos.save()
    }

    io.to(sala.name).emit('muestra', mostrarPuntos)

    setTimeout(() => {
      io.to(sala.name).emit('salaAbandonada', data)
    }, 3000);
    await salaM.findOneAndDelete({ name: salaX.name })

    return
  } catch (err) {
    console.log("error dentro de funcion juegoTerminado y el mensaje de error es: ", err.message)
    return
  }
}

const booleanos = async (res) => {
  try {
    const sala = await salaM.findOne({ name: res.sala });
    switch (res.canto) {
      case 'envido':
        sala.cantosenmano.boolEnvido = true;

        break;
      case 'reEnvido':
        sala.cantosenmano.boolReEnvido = true;
        break;
      case 'realEnvido':
        sala.cantosenmano.boolRealEnvido = true;
        break;
      case 'faltaEnvido':
        sala.cantosenmano.boolFaltaEnvido = true;
        break;
      case 'flor':
        sala.cantosenmano.boolFlor = true;
        sala.usuarios.forEach(element => {
          if (element.id == res.jugador.id) {
            element.cantoFlor = true
          }
        })
        break;
      case 'florFlor':
        sala.cantosenmano.boolFlorFlor = true;
        break;
      case 'florMeAchico':
        sala.cantosenmano.boolFlorMeAchico = true;
        break;
      case 'contraFlor':
        sala.cantosenmano.boolContraFlor = true;
        break;
      case 'truco':
        sala.cantosenmano.boolTruco = true;
        sala.usuarios.forEach(element => {
          if (element.id == res.jugador.id) {
            element.puedeCantar = false
          } else {
            element.puedeCantar = true
          }
        })
        break;
      case 'reTruco':
        sala.cantosenmano.boolReTruco = true;
        sala.usuarios.forEach(element => {
          if (element.id == res.jugador.id) {
            element.puedeCantar = false
          } else {
            element.puedeCantar = true
          }
        })
        break;
      case 'valeCuatro':
        sala.cantosenmano.boolValeCuatro = true;
        sala.usuarios.forEach(element => {
          element.puedeCantar = false
        })
        break;
    }
    sala.cantosenmano.faltaRespuesta = true;
    sala.cantosenmano.canto = res.canto;
    sala.cantosenmano.jugador = res.jugador.id
    res.cantosenmano = sala.cantosenmano;
    await sala.save();
    return (res)
  } catch (err) {
    console.log("error dentro de funcion booleanos y el mensaje de error es: ", err.message)
    return
  }
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
      if (element.id.toHexString() == idJugador) {
        ultimaJugada = element.jugada[element.jugada.length - 1]
        if (!ultimaJugada) {
          //console.log("la ultima jugada del usuario es undefinid")
        }
        posicion = users.indexOf(element);
      }
    })
    if (users[posicion].tieneFlor && !users[posicion].cantoFlor) {
      if (users[posicion].jugada.length == 3) {//tenia flor, no la canto y tiro las 3 cartas
        if (sala.cantosenmano.posGanMentira == posicion) {//si gano el punto el q tenia la flor
          if (posicion == 0) {//le pongo 3 al otro q no era
            users[1].tantos += 3
            users[0].tantos -= sala.cantosenmano.puntosDevolver //le resto el puntaje que gano y le sumo los 3 puntos de la cantora al otro
          } else {
            users[0].tantos += 3
            users[1].tantos -= sala.cantosenmano.puntosDevolver
          }

        } else {//si gano el punto el q no tenia la flor
          if (posicion == 0) {//
            users[1].tantos -= sala.cantosenmano.puntosDevolver
            users[1].tantos += 3
          } else {
            users[0].tantos -= sala.cantosenmano.puntosDevolver
            users[0].tantos += 3
          }
        }

      } else {
        if (users[posicion].noTirar.length > 0) {//quiere decir que hay cartas que no debe tirar
        }
      }
    }
    let devolver = await salaM.findOneAndUpdate({ name: salaName }, { $set: { usuarios: users } })
    return devolver



  } catch (err) {
    console.log("error dentro de funcion verificarCantora y el mensaje de error es: ", err.message)
    return
  }
  return
}

//al terminar la partida sumo los tantos deacuerdo a lo cantado y al jugador q ganó
const sumarTantosAPartida = async (salaX, jugador) => {
  try {
    let sala = await salaM.findById({ _id: salaX._id });
    if (sala.cantosenmano.boolValeCuatro) {
      sala.usuarios[jugador].tantos += 4;
    } else {
      if (sala.cantosenmano.boolReTruco) {
        sala.usuarios[jugador].tantos += 3;
      } else {
        if (sala.cantosenmano.boolTruco) {
          sala.usuarios[jugador].tantos += 2;
        } else {
          sala.usuarios[jugador].tantos += 1;
        }
      }
    }

    await sala.save()
    return
  } catch (err) {
    console.log("error dentro de funcion sumarTantosAPartida y el mensaje de error es: ", err.message)
    return
  }
}


//Acá tengo que pasar los dos jugadores que están en la sala cada vez que se tira
//COMPARA VALORES DE LAS CARTAS PERO DETERMINA SI TERMINÓ LA MANO CON TRUE O FALSE
//Y LLAMA A sumarTantosAPartida (QUE SUMA SOLO EL RABON) SI YA TERMINÓ
const compararValores = async (sala) => {
  try {
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
          await sala.save();
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { cantosenmano: sala.cantosenmano } });
          return false
        }
        //aca va si tienen el mismo valor pero no es la primera carta, puede ser la segunda o 3ra
        if (jugador2.jugada.length === 2) {//comparo con 1 solo ya que tienen la misma cantidad de jugadas
          if (sala.cantosenmano.pardaPrimera) {
            if (users[0].mano) {
              await sumarTantosAPartida(sala, 0)
            }
            else {
              await sumarTantosAPartida(sala, 1)

            }
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            return true
          } else {
            if (users[0].ganoPrimera) {
              await sumarTantosAPartida(sala, 0)
              await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
              return true
            }
            else {
              await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
              await sumarTantosAPartida(sala, 1)
              return true
            }

          }


        } //
        if (jugador2.jugada.length === 3) {//comparo con 1 solo ya que tienen la misma cantidad de jugadas

          if (users[0].ganoPrimera) {
            await sumarTantosAPartida(sala, 0)
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            return true
          }
          else {
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            await sumarTantosAPartida(sala, 1)
            return true
          }
        }
      }
      if (jugada1.valor > jugada2.valor) {
        jugador1.juega = true;
        jugador2.juega = false;
        if (jugador2.jugada.length === 1) {
          jugador1.ganoPrimera = true; //si es la primera jugada solo anoto que gano la primera y le vuelve a tocar jugar
          return false
        }
        if (jugador1.jugada.length === 2) { //si es la 2da jugada y ya gano primera termina la ronda y le sumo los puntos de lo cantado
          if (users[0].ganoPrimera || sala.cantosenmano.pardaPrimera) {
            await sumarTantosAPartida(sala, 0)
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            return true
          }

          return false
        }
        if (jugador1.jugada.length === 3) {//si gana en la 3ra le sumo los puntos de lo cantado
          await sumarTantosAPartida(sala, 0)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          return true
        }

      }
      if (jugada2.valor > jugada1.valor) {
        //Si el valor de la última jugada del jugador 2 es mayor, se incrementa el puntaje del jugador 2 
        jugador1.juega = false;
        jugador2.juega = true;
        if (jugador2.jugada.length === 1) {
          jugador2.ganoPrimera = true;
          return false
        }
        if (jugador2.jugada.length === 2) {

          if (users[1].ganoPrimera || sala.cantosenmano.pardaPrimera) {

            await sumarTantosAPartida(sala, 1)
            await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
            return true
          } else {

            return false
          }
        }
        if (jugador2.jugada.length === 3) {
          await sumarTantosAPartida(sala, 1)
          await salaM.findOneAndUpdate({ _id: sala._id }, { $set: { finish: true } });
          return true
        }

      }
    } else {
      //Si los jugadores no tienen el mismo número de jugadas no se puede hacer la comparación.
      jugador2.juega = !jugador2.juega;
      jugador1.juega = !jugador1.juega;
      return false
    }
  } catch (err) {
    console.log("error dentro de funcion compararValores y el mensaje de error es: ", err.message)
    return false
  }
}
//Acá tengo que pasar los dos jugadores que están en la sala actualizados cada vez que se tira
const terminar = async (salaX) => {
  try {
    let sala = await salaM.findOne({ name: salaX.name })
    if (sala.finish) {
      sala.partida += 1
    }
    let terminoTodo = await juegoFinalizado(sala)
    if (terminoTodo) {



      return true

    } else {
      return false
    }
  } catch (err) {
    console.log("error dentro de funcion terminar y el mensaje de error es: ", err.message)
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
      return false
    }
  } catch (err) {
    console.log("error dentro de funcion juegoFinalizado y el mensaje de error es: ", err.message)
    return false

  }
}

//La función getRandomInt está diseñada para generar un número entero aleatorio entre dos valores, min (incluido) y max (excluido).
function getRandomInt(min, max) {
  try {
    min = Math.ceil(min);
    max = Math.floor(max);
    valor = Math.floor(Math.random() * (max - min) + min);
  } catch (err) {
    console.log("error dentro de funcion getRandomInt y el mensaje de error es: ", err.message)
  }
}

//Función que reparte tres cartas diferentes a cada jugador.
const repartir = async (salaX) => {
  try {

    //Se recibe la sala para la que hay que repartir y se busca en la base de datos
    const salaOn = await salaM.findOne({ name: salaX.name })
    //Obtenemos los usuarios de la sala encontrada 
    const users = salaOn.usuarios
    salaOn.finish = false;
    //A esos usuarios los pasamos como argumento a la función repartir que es la que va a asignar 3 cartas a cada jugador
    let jugador1 = users[0];
    let jugador2 = users[1];
    jugador1.timeJugada = 60;
    jugador2.timeJugada = 60;
    jugador1.debeResponder = false;
    jugador2.debeResponder = false;
    jugador1.realizoCanto = false;
    jugador2.realizoCanto = false;
    jugador1.valores = [];
    jugador2.valores = [];
    jugador1.jugada = [];
    jugador2.jugada = [];
    jugador1.puntosMentira = 0;
    jugador2.puntosMentira = 0;
    jugador1.cartasAMostrar = [];
    jugador2.cartasAMostrar = [];
    jugador1.boolCartasAMostrar = false;
    jugador2.boolCartasAMostrar = false;
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
    jugador1.cartasAMostrar = temp1.cartasAMostrar;
    jugador2.cartasAMostrar = temp2.cartasAMostrar;
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
    salaOn.rivalAusente = false
    salaOn.cantosenmano.mostrarPuntos = false;
    salaOn.cantosenmano.florNegada = false;
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
    salaOn.rivalAlMazo = false;

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
    await salaOn.save();
    io.to(salaOn.name).emit('repartir', salaOn)
  } catch (err) {

    console.log("error dentro de funcion repartir y el mensaje de error es: ", err.message)
    return
  }
}
//La función tieneEnvido determina si hay "envido" en una mano de cartas, y calcula los puntos de envido para un jugador específico.
const tieneEnvido = (val, num) => {
  try {
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
        cartasAMostrar: [val[0], val[1], val[2]],
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
        if (primRes) {
          primRes.cartasAMostrar = [val[0], val[1]],
            primRes.flor = false
          return primRes
        }
        if (segRes) {
          segRes.cartasAMostrar = [val[0], val[2]],
            segRes.flor = false
          return segRes
        }
        if (terRes) {
          terRes.cartasAMostrar = [val[1], val[2]],
            terRes.flor = false
          return terRes
        }
      } else {
        //Si no hay dos cartas con el mismo palo, se calcula el punto más alto de las tres cartas.
        // Se convierte cada nombre de carta a un número usando parseInt.
        // Se encuentra el valor máximo entre las tres cartas.
        // Si el valor máximo es mayor que 10, se ajusta a 10 
        let val0 = parseInt(val[0].name)
        let val1 = parseInt(val[1].name)
        let val2 = parseInt(val[2].name)
        let max, pos
        if (val0 >= 10 && val1 >= 10 && val2 >= 10) {
          max = 10
          pos = 0
        } else {
          const menoresOIgualesADiez = [val0, val1, val2].filter(val => val < 10);
          max = Math.max(...menoresOIgualesADiez);
          pos = [val0, val1, val2].indexOf(max);
        }

        // Se crea y retorna un objeto puntosFinales que contiene un mensaje, el número del jugador y los puntos calculados.
        let puntosFinales = {
          mensaje: `El jugador ${num} tiene ${max} puntos`,
          jugadorNum: num,
          puntos: max,
          cartasAMostrar: [val[pos]],
          flor: false
        }
        return puntosFinales
      }
    }
  } catch (err) {
    console.log("error dentro de funcion tieneEnvido y el mensaje de error es: ", err.message)
    return
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
  try {
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
  } catch (err) {
    console.log("error dentro de funcion tieneEnvido y el mensaje de error es: ", err.message)
    return
  }
}




