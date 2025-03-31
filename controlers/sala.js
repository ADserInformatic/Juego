const sala = require("../modelos/sala")
const user = require('../modelos/user')



const getSalas = async (req, res) => {

    try {
        const id = req.params.id //guardo el id del que consulta salas

        const salas = await sala.find({}) //guardo todas las salas...
        if (salas.length > 0) {
            let retornarSalas = [];
            let participa = [];
            let hayLugar = [];
            await salas.forEach(async (element) => {
                if (element.usuarios.length == 2) {
                    element.usuarios.forEach(async (u) => {
                        if (u.id.toHexString() == id) {
                            participa.push(element);
                        }
                    })
                }
                else {
                    if (element.usuarios.length < 2) {
                        hayLugar.push(element)
                    }
                }
            })
            retornarSalas = participa.concat(hayLugar)
            res.json({
                error: false,
                data: retornarSalas,
                mensaje: 'La solicitud se resolvió de forma exitosa'
            })
        } else {
            res.json({
                error: true,
                mensaje: `el array salas esta vacio`
            })
        }
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor responde con el siguiente error: ${e}`
        })
    }
}

const saveSala = async (req, res) => {
    try {
        const { name, apuesta, usuarios } = req.body
        const salaExiste = await sala.findOne({ name })
        if (salaExiste) {
            return res.json({
                error: false,
                data: salaExiste,
                denegado: true,
                mensaje: 'No pueden existir dos salas con el mismo nombre'
            })
        }
        const usuario = await user.findOne({ _id: usuarios[0].id })
        if (usuario.credito < apuesta) {
            res.json({
                error: true,
                mensaje: `El crédito es insuficiente`
            })
        }


        usuario.credito -= apuesta;
        await usuario.save();
        usuarios[0].name = usuario.name
        usuarios[0].creditos = usuario.credito
        const creado = await sala.create({ name, apuesta, usuarios })


        res.json({
            error: false,
            data: creado,
            mensaje: 'La solicitud se resolvió de forma exitosa'
        })
        setTimeout(async () => {
            try {
                const salaActualizada = await sala.findOne({ name })
                if (salaActualizada && salaActualizada.usuarios.length === 1) {
                    let creador = await user.findOne({ name: salaActualizada.usuarios[0].name })
                    if (creador) {
                        creador.credito += salaActualizada.apuesta;
                        await creador.save()
                        await sala.findByIdAndDelete({ _id: salaActualizada._id })
                    }
                }
            } catch (e) {
                console.log("algo malio sal en settimeout expirar y fue: ", e.message)

            }
        }, 300000); // 5 minutos 300000



    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor responde con el siguiente error: ${e.message}`
        })
    }
}

const getSala = async (req, res) => {
    const id = req.params.id
    const s = await sala.findOne({ _id: id })
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

const deleteSala = async (req, res) => {
    const id = req.params.id
    const del = await sala.findByIdAndDelete({ _id: id })
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

const addUser = async (req, res) => {
    //En el parámetro viene el id de la sala
    const id = req.params.id
    //En el dato viene el id del usuario
    const _id = req.body.id
    //Busco el usuario a partir del id
    const buscar = await user.findOne({ _id })
    //Si existe el usuario se continúa
    if (buscar) {
        //Una vez que se sabe que existe el usuario se busca la sala a la que quiere ingresar
        const actual = await sala.findOne({ _id: id })
        if (!actual) {
            return res.json({
                error: false,
                data: "",
                mensaje: 'Ya no esta disponible la sala',
                denegado: true
            })
        }
        //Si en la sala ya hay 2 jugadores y el que está intentando ingresar es distinto al primer jugador retorna un error
        if (actual.usuarios.length > 1 && actual.usuarios[0].id.toHexString() !== buscar._id.toHexString()) {
            if (actual.usuarios[1]) {
                if (actual.usuarios[1].id.toHexString() === buscar._id.toHexString()) {
                    return res.json({
                        error: false,
                        data: actual
                    });
                }
            } else {
                return res.json({
                    error: false,
                    data: actual,
                    mensaje: 'No puede haber más de 2 jugadores en la sala. Para ingresa, uno de los jugadores actuales deberá retirarse',
                    denegado: true
                })
            }
        }
        //Si el usuario ya está en la sala lo deja ingresar
        if (actual.usuarios[0].id.toHexString() === buscar._id.toHexString()) {
            return res.json({
                error: false,
                data: actual
            });
        }
        //Corroboro que le alcance el credito
        if (buscar.credito < actual.apuesta) {
            res.json({
                error: true,
                mensaje: `El crédito es insuficiente`
            })
        }
        //Hechas las comprobaciones anteriores, se guarda al usuario en la sala
        buscar.credito -= actual.apuesta;
        await buscar.save()
        const dato = {
            name: buscar.name,
            creditos: buscar.credito,
            id: buscar._id,
            valores: req.body.valores
        }
        actual.usuarios.push(dato)
        const resultado = await sala.findByIdAndUpdate({ _id: id }, { $set: { usuarios: actual.usuarios } })
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
        res.json({
            error: true,
            mensaje: 'No se encontró ningún usuario con el ID proporcionado',
        });
    }
}

module.exports = { getSala, getSalas, saveSala, deleteSala, addUser }