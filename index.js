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

const socketIo = require('socket.io');
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:4200']
  }
});

app.use('/', user)
app.use('/sala', sala)
app.use('/carta', carta)
//Wwbsocket
io.on('connection', (socket) => {
  socket.on('sala', async (id)=>{
    const sala = await salaM.findOne({_id: id})
    socket.join(sala.name)
    
    io.to(sala.name).emit('sala', sala)
  })

  socket.on('repartir', async (_sala)=>{
    const salaOn = await salaM.findOne({_id: _sala._id})
    const users = salaOn.usuarios
    await repartir(users[0], users[1])
    
    await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})
    
    const salaActualizada = await salaM.findOne({_id: salaOn._id})
    io.to(salaOn.name).emit('repartir', salaActualizada)
  })

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
    compararValores(users[0], users[1])
    terminar(users[0], users[1])
    //Una vez actualizado el usuario se actualiza la sala
    await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})
    //Una vez actualizada la sala se vuelve a buscar para devolverla al front (el update no devuelve el objeto actualizado, por eso este paso extra)
    const salaActualizada = await salaM.findOne({_id: salaOn._id})
    //Una vez hecho todo esto se emite hacia el front la sala con los nuevos datos
    
    io.to(salaOn.name).emit('muestra', salaActualizada)
  })

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
const compararValores = async (jugador1, jugador2)=>{
  const jugada1 = jugador1.jugada[jugador1.jugada.length - 1]
  const jugada2 = jugador2.jugada[jugador2.jugada.length - 1]
  if(jugador1.jugada.length === jugador2.jugada.length){  
    if(jugada1.valor === jugada2.valor){
      jugador1.tantosPartida += 1
      jugador2.tantosPartida += 1
      return console.log('empate')
    }
    if(jugada1.valor > jugada2.valor){
      jugador1.tantosPartida += 1
      return console.log('Gana ', jugador1.name, 'Tiene ', jugador1.tantosPartida)
    }else{
      jugador2.tantosPartida += 1
      return console.log('Gana ', jugador2.name, 'Tiene ', jugador2.tantosPartida)
    }
  }else{
    console.log('falta una carta')
  }
}

const terminar = (jugador1, jugador2)=>{
  if (jugador1.jugada.length === jugador2.jugada.length) {
    if(jugador1.jugada.length === 3){
      if (jugador1.tantosPartida > jugador2.tantosPartida ) {
        jugador1.tantos += 1
        
        return console.log('Ganador de la partida: ', jugador1.name)
      } else {
        jugador2.tantos += 1
        return console.log('Ganador de la partida: ', jugador2.name)
      }
    }
  } else {
    console.log('Siga')
  }
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  valor = Math.floor(Math.random() * (max - min) + min);
}


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

const calcularPuntos = (valoresJ1, valoresJ2)=>{
  
  let jug1 = tieneEnvido(valoresJ1, 1)
  let jug2 = tieneEnvido(valoresJ2, 2)
  return {jug1, jug2}
  // for (let index = 0; index < valoresJ1.length; index++) {
  //   const element = valoresJ1[index].charAt(1);
  //   valores1.push()
  // }
  // if(valores1 > valores2){
  //   console.log(`Gana el 1 con: ${valores1} puntos`)
  // }
}

const tieneEnvido = (val, num)=>{
  let pts;

  let palo1 = val[0].name.match(/[a-zA-Z]+/g).join('');
  let palo2 = val[1].name.match(/[a-zA-Z]+/g).join('');
  let palo3 = val[2].name.match(/[a-zA-Z]+/g).join('');

  if(palo1 === palo2 || palo1 === palo3 || palo2 === palo3 ){
    console.log(`Hay envido para ${num}`)
    let primRes = sumaPts(palo1, palo2, val[0].name, val[1].name, num)
    let segRes = sumaPts(palo1, palo3, val[0].name, val[2].name, num)
    let terRes = sumaPts(palo2, palo3, val[1].name, val[2].name, num)
    if(primRes){ return primRes}
    if(segRes){ return segRes}
    if(terRes){ return terRes}
  }else{
    console.log(`No hay envido para ${num}`)
    let val0 = parseInt(val[0].name)
    let val1 = parseInt(val[1].name)
    let val2 = parseInt(val[2].name)
    let max = Math.max(...[val0, val1, val2])
    if(max > 10){
      max = 10
    }
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

const sumaPts = (carta1, carta2, valor1, valor2, num)=>{
  if(carta1 === carta2){
    let priValor = parseInt(valor1)
    let segValor = parseInt(valor2)
    if(parseInt(valor1) > 10){
      priValor = 10
    }
    if(parseInt(valor2) > 10){
      segValor = 10
    }
    pts = priValor + segValor + 10
    if(parseInt(valor2) < 10 && parseInt(valor1) < 10){
      pts += 10
    }
    if(parseInt(valor2) > 9 && parseInt(valor1) > 9){
      pts = 20
    }
    let puntosFinales = {
      mensaje: `El jugador ${num} tiene ${pts} puntos`,
      jugadorNum: num,
      puntos: pts
    }
    return puntosFinales
  }
}