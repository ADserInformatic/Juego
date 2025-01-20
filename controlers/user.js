const user = require('../modelos/user')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SECRET_KEY = 'ADserTruco';
/* // Generar el token
const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
res.json({ token }); */
// Encabezado: Authorization: Bearer &lt;tu_token_jwt>



const getUser = async (req, res) => {
    const users = await user.find({})
    try {
        res.json({
            error: false,
            data: users,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}

const getUsers = async (req, res) => {
    const users = await user.find({})
    try {
        res.json({
            error: false,
            data: users,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}
const saveUser = async (req, res) => {
    console.log(req.body)
    const { name, credito } = req.body

    const save = await user.create({ name, credito })
    try {
        res.json({
            error: false,
            data: save,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}
const addUser = async (req, res) => {
    const { name, credito, passAdmin } = req.body

    //CORROBORAR PASS DEL ADMINISTRADOR

    let CreditBefore = 0;
    let CreditAfter = credito;
    let passUser = encript('123456Aa');
    letloadHistory = [
        {
            carga: credito,
            creditBefore: CreditBefore,
            creditAfter: CreditAfter,
            date: new Date()
        }
    ]
    const save = await user.create({ name, credito, passUser, loadHistory })
    try {
        await save.save();
        res.json({
            error: false,
            data: save,
            mensaje: 'Usuario CREADO EXITOSAMENTE'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }

}

const addCredit = async (req, res) => { //ver donde tengo el id
    let idUser = req.params.id;
    let usuario = await user.findOne({ _id: idUser });
    const { credit } = req.body

    //CORROBORAR PASS DEL ADMINISTRADOR
    let currentCredit = usuario.credito + credit;
    let currentLoadHistory = [
        {
            carga: credit,
            creditBefore: usuario.credito,
            creditAfter: usuario.credito + credit,
            date: new Date()
        }
    ]
    const save = await user.findByIdAndUpdate({ _id: idUser }, { $set: { credito: currentCredit, loadHistory: currentLoadHistory } })
    try {
        await save.save();
        res.json({
            error: false,
            data: save,
            mensaje: 'CREDITO CARGADO EXITOSAMENTE'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }

}

function encript(passToEncript) {
    let passToEncripted = bcrypt.hash(passToEncript, 10, (err, hash) => {
        if (err) {
            console.error('Error al hashear la contraseña:', err);
            return;
        }
    })
    return passToEncripted
}
function decript() { }



module.exports = router