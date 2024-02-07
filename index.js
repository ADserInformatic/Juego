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
    io.sockets.emit('sala', sala)
  })

  socket.on('repartir', async (_sala)=>{
    const salaOn = await salaM.findOne({_id: _sala._id})
    const users = salaOn.usuarios
    await repartir(users[0], users[1])
    
    await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})
    
    const salaActualizada = await salaM.findOne({_id: salaOn._id})
    io.sockets.emit('repartir', salaActualizada)
  })

  socket.on('tirar', async (jugada)=>{
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
    io.sockets.emit('muestra', salaActualizada)
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
  console.log()
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
  console.log(jugador1, jugador2)
}