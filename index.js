const express = require('express') ;
const app = express();
const user = require('./rutas/user');
const sala = require('./rutas/sala');
const carta = require('./rutas/cartas')
const userM = require('./modelos/user');
const salaM = require('./modelos/sala');
const cartaM = require('./modelos/carta')
const mongoose = require('mongoose');
const cors = require('cors');

app.use(cors())
// Conexión a Base de datos

const uri =`mongodb+srv://mariagranderepuestos:Q7SF1YmbsyxEGgtO@trucooooo.of3sbb7.mongodb.net/?retryWrites=true&w=majority`

mongoose.connect(uri,{
  useUnifiedTopology: true,
  useNewUrlParser: true
 })
.then(() => console.log('Base de datos conectada'))
.catch(e => console.log('error db:', e))

app.use(express.urlencoded({extended:false}));
app.use(express.json());
app.use(express.raw());

const server = app.listen(process.env.PORT || 3006, () => {
  console.log('Server is running on port 3006');
});

//Conexión con socketIo, cambiar el localhos por el dominio del front.
const socketIo = require('socket.io');
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:4200']
  }
});

//Rutas
app.use('/', user)
app.use('/sala', sala)
app.use('/carta', carta)
//Wwbsocket
//En qué momento se hace la conexión lo manejo desde el front
io.on('connection', (socket) => {
  socket.on('sala', async (id)=>{
    const sala = await salaM.findOne({_id: id})
    socket.join(sala.name)
    //Lo que está entre parentesis limita los usuarios a los que emito. En este los usuarios que esten en la sala con el mismo nombre.
    //La diferencia entre io.to y socket.to es que, en el primer caso se emite para todos los usuarios que están dentro de la sala. En el siguiente caso se obvia a quien hizo la petición al back
    io.to(sala.name).emit('sala', sala)
  })

  //Con socket.io se utiliza emit para emitir una acción y on para escuchar esa acción, lo que debe coinsidir es el nombre que va entre comillas
  //Se escucha la acción 'repartir' y se ejecuta la siguiente función
  socket.on('repartir', async (_sala)=>{
    //Se recibe la sala para la que hay que repartir y se busca en la base de datos
    const salaOn = await salaM.findOne({_id: _sala._id})
    //Obtenemos los usuarios de la sala encontrada 
    const users = salaOn.usuarios
    //A esos usuarios los pasamos como argumento a la función repartir que es la que va a asignar 3 cartas a cada jugador
    await repartir(users[0], users[1])

    //Una vez que cada jugador tiene sus cartas se actualiza la sala
    await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})

    //Una vez que se actualiza, se busca la sala (la acción anterior me devuelve la sala sin actualizar, por eso este paso adicional) y se devuelve a travez del emit 'repartir'
    const salaActualizada = await salaM.findOne({_id: salaOn._id})
    io.to(salaOn.name).emit('repartir', salaActualizada)
  })

  //Cada vez que un usuario tira (presiona) una carta, se ejecuta esta acción
  socket.on('tirar', async (jugada)=>{
    console.log(jugada)
    //LLega un objeto con los datos de la jugada (sala, id del usuario y valor jugado)
    //Se busca la sala en la que se está jugando a partir del nombre
    const salaOn = await salaM.findOne({name: jugada.sala})
    //Se guarda los usuarios que están jugando en esa sala en un array
    const users = salaOn.usuarios
    users.forEach(async (element)=>{
      //Recorro los usuarios en esa sala y al que coincide con el id del que hizo la jugada se le actualizan los datos
      if (jugada.idUser === element.id.toHexString()) {
        element.valores = element.valores.filter(e => e.name != jugada.carta)
        //Agregamos la nueva jugada al usuario en cuestión
        element.jugada.push(jugada)
      }else{console.log('nada')}
    })
    //Una vez que se actualiza la jugada al usuario que la realizá, se compara los valores. La función compararValores compara las últimas jugadas de los jugadores y actualiza el puntaje dependiendo del resultado de la comparación.
    compararValores(users[0], users[1])
    //La función terminar determina si una partida entre dos jugadores ha terminado basándose en el número de jugadas realizadas y declara al ganador
    terminar(users[0], users[1])
    //Una vez actualizado el usuario se actualiza la sala
    await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})
    //Una vez actualizada la sala se vuelve a buscar para devolverla al front (el update no devuelve el objeto actualizado, por eso este paso extra)
    const salaActualizada = await salaM.findOne({_id: salaOn._id})
    //Una vez hecho todo esto se emite hacia el front la sala con los nuevos datos
    
    io.to(salaOn.name).emit('muestra', salaActualizada)
  })

  //Cuando un jugador canta (envido, flor o truco), se emite al otro jugador el canto y, en caso de requerirse, se espera una respuesta.
  socket.on('canto', (res)=>{
    socket.to(res.sala).emit('cantando', res)
  })

  //Esto está recibiendo tanto envido como truco y flor. ¡Tener eso en cuenta!
  socket.on('respuestaCanto', async (res)=>{
    if(res.canto === 'envido'){
      //Si quiere se suman los puntos y directamente se da al ganador
      const sala = await salaM.findOne({name: res.sala})
      const users = sala.usuarios
      if (res.respuesta === 'quiero') {
        //Acá paso los usuarios a la función que calcula los puntos
        const resultado = calcularPuntos(users[0].valores, users[1].valores)
        if(resultado.jug1.puntos > resultado.jug2.puntos){
          users[0].tantosPartida += 2
          await salaM.findOneAndUpdate({name: res.sala}, {$set: {usuarios: users}})
         
          let mensaje = `Gana ${users[0].name} con ${resultado.jug1.puntos} puntos`
          let datos = {
            mensaje,
            sala
          } 
          io.to(res.sala).emit('resultadoDeCanto', datos)
        }
        if(resultado.jug1.puntos < resultado.jug2.puntos){
          users[1].tantosPartida += 2
          await salaM.findOneAndUpdate({name: res.sala}, {$set: {usuarios: users}})
          let mensaje = `Gana ${users[1].name} con ${resultado.jug2.puntos} puntos`
          let datos = {
            mensaje,
            sala
          } 
          io.to(res.sala).emit('resultadoDeCanto', datos)
        }
      } else {
        console.log('No quiere ', res)
        users.forEach(us=>{
          if(us.name === res.jugador.name){
            us.tantosPartida += 2
          }else{
            m = `${us.name} no quiere`
          }
        })
        await salaM.findOneAndUpdate({name: res.sala}, {$set: {usuarios: users}})
        let datos = {
          mensaje: m,
          sala
        } 
        io.to(res.sala).emit('resultadoDeCanto', datos)
      }
      //Si no quiere se muestra la respuesta y se continúa
      // socket.to(res.sala).emit('respuestaCanto', res.respuesta)
    }
    if(res.canto === 'reenvido'){
      if(res.respuesta === 'quiero'){
        console.log('Se juega por 4')
        const sala = await salaM.findOne({name: res.sala})
        const users = sala.usuarios

        const resultado = calcularPuntos(users[0].valores, users[1].valores)
        if(resultado.jug1.puntos > resultado.jug2.puntos){
          users[0].tantosPartida += 4
          await salaM.findOneAndUpdate({name: res.sala}, {$set: {usuarios: users}})
         
          let mensaje = `Gana ${users[0].name} con ${resultado.jug1.puntos} puntos`
          let datos = {
            mensaje,
            sala
          } 
          io.to(res.sala).emit('resultadoDeCanto', datos)
        }
        if(resultado.jug1.puntos < resultado.jug2.puntos){
          users[1].tantosPartida += 2
          await salaM.findOneAndUpdate({name: res.sala}, {$set: {usuarios: users}})
          let mensaje = `Gana ${users[1].name} con ${resultado.jug2.puntos} puntos`
          let datos = {
            mensaje,
            sala
          } 
          io.to(res.sala).emit('resultadoDeCanto', datos)
        }

      }
      if(res.respuesta === 'noquiero'){
        console.log('Son 2')
      }
      socket.to(res.sala).emit('cantando', res)
    }
  })
});
    
//Acá tengo que pasar los dos jugadores que están en la sala cada vez que se tira
const compararValores = (jugador1, jugador2)=>{
  //Aquí, se obtienen las últimas jugadas de cada jugador. 
  const jugada1 = jugador1.jugada[jugador1.jugada.length - 1]
  const jugada2 = jugador2.jugada[jugador2.jugada.length - 1]
  //Este if verifica que ambos jugadores tengan el mismo número de jugadas. Si no es así, se ejecutará el bloque else.
  if(jugador1.jugada.length === jugador2.jugada.length){  
    //Si los valores de las últimas jugadas son iguales, se incrementa el puntaje (tantosPartida) de ambos jugadores.
    if(jugada1.valor === jugada2.valor){
      jugador1.tantosPartida += 1
      jugador2.tantosPartida += 1
      return console.log('empate')
    }
    //Si el valor de la última jugada del jugador 1 es mayor que el del jugador 2, se incrementa el puntaje del jugador 1 
    if(jugada1.valor > jugada2.valor){
      jugador1.tantosPartida += 1
      return console.log('Gana ', jugador1.name, 'Tiene ', jugador1.tantosPartida)
    }else{
      //Si el valor de la última jugada del jugador 2 es mayor, se incrementa el puntaje del jugador 2 
      jugador2.tantosPartida += 1
      return console.log('Gana ', jugador2.name, 'Tiene ', jugador2.tantosPartida)
    }
  }else{
    //Si los jugadores no tienen el mismo número de jugadas no se puede hacer la comparación.
    console.log('falta una carta')
  }
}

//Acá tengo que pasar los dos jugadores que están en la sala actualizados cada vez que se tira
const terminar = (jugador1, jugador2)=>{
  if (jugador1.jugada.length === jugador2.jugada.length) {
    //Se verifica si cada jugador ha realizado 3 jugadas. Si no es así, no se hace nada y no se declara un ganador.
    if(jugador1.jugada.length === 3){
      //Si el puntaje de la partida (tantosPartida) del jugador 1 es mayor que el del jugador 2, se incrementa el puntaje total (tantos) del jugador 1 y se imprime un mensaje indicando que el jugador 1 es el ganador de la partida.
      if (jugador1.tantosPartida > jugador2.tantosPartida ) {
        jugador1.tantos += 1
        return console.log('Ganador de la partida: ', jugador1.name)
      } else {
        //Si el puntaje de la partida del jugador 2 es mayor o igual, se incrementa el puntaje total del jugador 2 y se imprime un mensaje indicando que el jugador 2 es el ganador de la partida.
        jugador2.tantos += 1
        return console.log('Ganador de la partida: ', jugador2.name)
      }
    }
  } else {
    console.log('Siga')
  }
}

//La función getRandomInt está diseñada para generar un número entero aleatorio entre dos valores, min (incluido) y max (excluido).
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  valor = Math.floor(Math.random() * (max - min) + min);
}

//Función que reparte tres cartas diferentes a cada jugador.
const repartir = async (jugador1, jugador2)=>{
  jugador1.valores = []
  jugador2.valores = []
  jugador1.jugada = []
  jugador2.jugada = []
  jugador2.tantosPartida = 0
  jugador1.tantosPartida = 0
  let values = []
  for (let i = 0; i < 6; i++) {
    getRandomInt(1, 40)
    values.forEach(e =>{
      if(e === valor){
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
}

//Para el envido se pasa a los dos jugadores por esta función para obtener los puntos
const calcularPuntos = (valoresJ1, valoresJ2)=>{
  
  let jug1 = tieneEnvido(valoresJ1, 1)
  let jug2 = tieneEnvido(valoresJ2, 2)
  return {jug1, jug2}
}

//La función tieneEnvido determina si hay "envido" en una mano de cartas, y calcula los puntos de envido para un jugador específico.
const tieneEnvido = (val, num)=>{
  let pts;

  //palo1, palo2, palo3: Se extraen las letras de las cadenas de texto name de las tres cartas. Se usa una expresión regular para obtener solo las letras.
  let palo1 = val[0].name.match(/[a-zA-Z]+/g).join('');
  let palo2 = val[1].name.match(/[a-zA-Z]+/g).join('');
  let palo3 = val[2].name.match(/[a-zA-Z]+/g).join('');

  //Se verifica si hay al menos dos cartas con el mismo palo, lo cual es necesario para el envido.
  if(palo1 === palo2 || palo1 === palo3 || palo2 === palo3 ){
    //Si hay al menos dos cartas con el mismo palo, se calcula los puntos del envido usando la función sumaPts.
    let primRes = sumaPts(palo1, palo2, val[0].name, val[1].name, num)
    let segRes = sumaPts(palo1, palo3, val[0].name, val[2].name, num)
    let terRes = sumaPts(palo2, palo3, val[1].name, val[2].name, num)
    //Si alguna de las combinaciones tiene envido, se retorna el resultado de sumaPts.
    if(primRes){ return primRes}
    if(segRes){ return segRes}
    if(terRes){ return terRes}
  }else{
    //Si no hay dos cartas con el mismo palo, se calcula el punto más alto de las tres cartas.
    // Se convierte cada nombre de carta a un número usando parseInt.
    // Se encuentra el valor máximo entre las tres cartas.
    // Si el valor máximo es mayor que 10, se ajusta a 10 
    let val0 = parseInt(val[0].name)
    let val1 = parseInt(val[1].name)
    let val2 = parseInt(val[2].name)
    let max = Math.max(...[val0, val1, val2])
    if(max > 10){
      max = 10
    }
    // Se crea y retorna un objeto puntosFinales que contiene un mensaje, el número del jugador y los puntos calculados.
    let puntosFinales = {
      mensaje: `El jugador ${num} tiene ${max} puntos`,
      jugadorNum: num,
      puntos: max
    }
    console.log(max)
    return puntosFinales
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
const sumaPts = (carta1, carta2, valor1, valor2, num)=>{
  if(carta1 === carta2){
    //Convierte los valores de las cartas a enteros.
    //Si el valor de alguna carta es mayor que 10, se ajusta a 10
    let priValor = parseInt(valor1)
    let segValor = parseInt(valor2)
    if(parseInt(valor1) > 10){
      priValor = 10
    }
    if(parseInt(valor2) > 10){
      segValor = 10
    }
    //Calcula los puntos sumando los valores de las cartas y agregando 10 puntos de envido base.
    pts = priValor + segValor + 10
    // Si ambas cartas tienen valores menores a 10, se añaden 10 puntos adicionales.
    if(parseInt(valor2) < 10 && parseInt(valor1) < 10){
      pts += 10
    }
    // Si ambas cartas tienen valores mayores a 9, se ajusta el puntaje a 20 (esto cubre el caso de dos cartas de figura, que suman 20 puntos de envido).
    if(parseInt(valor2) > 9 && parseInt(valor1) > 9){
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