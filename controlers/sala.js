const sala = require("../modelos/sala")
const user = require('../modelos/user')


const getSalas = async (req, res)=>{
    const salas = await sala.find({})
    try {
        res.json({
            error: false,
            data: salas,
            mensaje: 'La solicitud se resolvió de forma exitosa'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor responde con el siguiente error: ${e}`
        })
    }
}

const saveSala = async (req, res)=>{
    const {name, apuesta, usuarios} = req.body
    const creado = await sala.create({name, apuesta, usuarios})
    console.log('El jugador 1 es: ', usuarios[0])
    try {
        res.json({
            error: false,
            data: creado,
            mensaje: 'La solicitud se resolvió de forma exitosa'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor responde con el siguiente error: ${e}`
        })
    }
}

const getSala = async (req, res)=>{
    const id = req.params.id
    const s = await sala.findOne({_id: id})
    try {
        res.json({
            error: false,
            data: s,
            mensaje: 'La solicitud se resolvió de forma exitosa'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor responde con el siguiente error: ${e}`
        })
    }
}

const deleteSala = async (req, res)=>{
    const id = req.params.id
    const del = await sala.findByIdAndDelete({_id: id})
    try {
        res.json({
            error: false,
            data: del,
            mensaje: 'La solicitud se resolvió de forma exitosa'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor responde con el siguiente error: ${e}`
        })
    }
}

//Faltaría una ruta donde se agrega un usuario a la sala

const addUser = async (req, res)=>{
    //En el parámetro viene el id de la sala
    const id = req.params.id
    //En el dato viene el id del usuario
    const _id = req.body.dato
    //Busco el usuario a partir del id
    const buscar = await user.findOne({_id})
    console.log('El jugador 2 es: ', buscar)
    //Si existe el usuario se continúa
    if (buscar) {
        //Una vez que se sabe que existe el usuario se busca la sala a la que quiere ingresar
        const actual = await sala.findOne({_id: id})
        //Si en la sala ya hay 2 jugadores y el que está intentando ingresar es distinto al primer jugador retorna un error
        if(actual.usuarios.length > 1 && actual.usuarios[0].toHexString() !== buscar._id.toHexString()){
            return res.json({
                    error: false,
                    data: actual,
                    mensaje: 'No puede haber más de 2 jugadores en la sala. Para ingresa, uno de los jugadores actuales deberá retirarse',
                    denegado: true
                })
        }
        //Si el usuario ya está en la sala lo deja ingresar
        if (actual.usuarios[0].toHexString() === buscar._id.toHexString()) {
            return res.json({
                error: false,
            });
        }
        //Hechas las comprobaciones anteriores, se guarda al usuario en la sala
        actual.usuarios.push(buscar._id)
        const resultado = await sala.findByIdAndUpdate({_id: id}, {$set: {usuarios: actual.usuarios}})
        try {
            res.json({
                error: false,
                data: resultado,
                mensaje: 'La solicitud se resolvió de forma exitosa'
            })
        } catch (e) {
            res.json({
                error: true,
                mensaje: `El servidor responde con el siguiente error: ${e}`
            })
        }
    } else {
        console.log('Me cansé')
        res.json({
            error: true,
            mensaje: 'No se encontró ningún usuario con el ID proporcionado',
          });
    }
}

module.exports = {getSala, getSalas, saveSala, deleteSala, addUser}