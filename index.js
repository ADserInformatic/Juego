const express = require('express') ;
const app = express();
const user = require('./rutas/user');
const sala = require('./rutas/sala');
const userM = require('./modelos/user');
const salaM = require('./modelos/sala');
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
//Wwbsocket
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('sala', async (id)=>{
    const sala = await salaM.findOne({_id: id})
    io.sockets.emit('sala', sala)
  })
    socket.on('tirar', async (jugada)=>{
      const salaOn = await salaM.findOne({name: jugada.sala})
      console.log(jugada, salaOn)
      const users = salaOn.usuarios
      users.forEach(async (element)=>{
        if (jugada.idUser === element.id.toHexString()) {
          element.jugada.push(jugada.valor)
          const resultante = await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})
          const otra = await salaM.findOne({_id: salaOn._id})
          io.sockets.emit('muestra', otra)
        }else{console.log('nada')}
      })
    })
});
    




