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
  
  socket.on('sala', async (id)=>{
    const sala = await salaM.findOne({_id: id})
    io.sockets.emit('sala', sala)
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
        //Agregamos la nueva jugada al usuario en cuestión
        element.jugada.push(jugada.valor)
        //Una vez actualizado el usuario se actualiza la sala
        await salaM.findByIdAndUpdate({_id: salaOn._id}, {$set: { usuarios: users}})
        //Una vez actualizada la sala se vuelve a buscar para devolverla al front (el update no devuelve el objeto actualizado, por eso este paso extra)
        const salaActualizada = await salaM.findOne({_id: salaOn._id})
        //Una vez hecho todo esto se emite hacia el front la sala con los nuevos datos
        io.sockets.emit('muestra', salaActualizada)
      }else{console.log('nada')}
    })
  })
});
    




