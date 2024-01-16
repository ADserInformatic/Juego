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
    socket.on('tirar', async (s)=>{
      const salaOn = await salaM.findOne({name: s.sala})
      console.log(s, salaOn)
      const users = salaOn.usuarios
      if (s.id === users[0].toHexString()) {
        io.sockets.emit('muestra', 'Jugador 1')
      } else {
        io.sockets.emit('muestra', 'Jugador 2')
      }
    })
});
    




