const user = require('../modelos/user')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SECRET_KEY = 'ADserTruco';
/* // Generar el token
const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
res.json({ token }); */
// Encabezado: Authorization: Bearer &lt;tu_token_jwt>



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
const getUser = async (req, res) => {
    let id = req.params.id
    const userX = await user.findOne({ _id: id })
    try {
        res.json({
            error: false,
            data: userX,
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
    const { name, credito } = req.body;

    // Validar que se hayan proporcionado name y credito
    if (!name || credito === undefined) {
        return res.status(400).json({
            error: true,
            mensaje: 'El nombre y el crédito son requeridos.'
        });
    }

    let CreditBefore = 0;
    let CreditAfter = credito;
    let password = await encript('123456Aa'); // Hasheo la contraseña
    let loadHistory = [
        {
            carga: credito,
            creditBefore: CreditBefore,
            creditAfter: CreditAfter,
            date: new Date()
        }
    ];

    try {
        const yaExiste = await user.findOne({ name: name });
        if (yaExiste) {
            return res.json({
                error: true,
                data: "",
                mensaje: 'NOMBRE DE USUARIO YA EXISTENTE'
            });
        }

        const save = await user.create({ name, credito, password, loadHistory });
        res.json({
            error: false,
            data: save,
            mensaje: 'Usuario CREADO EXITOSAMENTE'
        });
    } catch (e) {
        res.status(500).json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error: ${e.message}`
        });
    }
};
const addCredit = async (req, res) => { //ver donde tengo el id
    let idUser = req.params.id;
    let usuario = await user.findOne({ _id: idUser });
    const { credit } = req.body
    usuario.credito = usuario.credito + credit;
    usuario.loadHistory.push(
        {
            carga: credit,
            creditBefore: usuario.credito,
            creditAfter: usuario.credito + credit,
            date: new Date()
        }
    )

    try {
        await usuario.save()
        res.json({
            error: false,
            data: usuario,
            mensaje: 'CREDITO CARGADO EXITOSAMENTE'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }

}

const removeCredit = async (req, res) => { //ver donde tengo el id
    let idUser = req.params.id;
    let usuario = await user.findOne({ _id: idUser });
    const { credit } = req.body
    if (usuario.credito < credit) {
        res.json({
            error: true,
            mensaje: `Credito insuficiente`
        })
    }
    let currentCredit = usuario.credito - credit;
    let currentLoadHistory = [
        {
            carga: credit,
            creditBefore: usuario.credito,
            creditAfter: usuario.credito - credit,
            date: new Date()
        }
    ]
    const save = await user.findByIdAndUpdate({ _id: idUser }, { $set: { credito: currentCredit, loadHistory: currentLoadHistory } })
    try {
        await save.save();
        res.json({
            error: false,
            data: save,
            mensaje: 'CREDITO QUITADO EXITOSAMENTE'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }

}

const login = async (req, res) => {
    let { name, passInput } = req.body;
    const usuario = usuarios.findOne({ name: name });

    if (!usuario) {
        res.json({
            error: true,
            data: "",
            mensaje: 'NOMBRE DE USUARIO NO ENCONTRADO'
        })
    }

    await bcrypt.compare(passInput, usuario.password, (err, result) => {
        if (err) {
            res.json({
                error: true,
                data: "",
                mensaje: 'Error al comparar contraseñas'
            })
        }

        if (result) {
            const token = jwt.sign({ usuario }, SECRET_KEY, { expiresIn: '1h' });
            res.json({
                error: false,
                data: token,
                mensaje: 'Inicio de sesión exitoso'
            })
        } else {
            res.json({
                error: true,
                data: "",
                mensaje: 'Error al comparar contraseñas'
            })
        }
    });
}

const encript = async (passToEncript) => {
    let passToEncripted = await bcrypt.hash(passToEncript, 10
    )
    return passToEncripted
}

function decript(passToEncripted) {

}

const funtions = {
    getUsers,
    getUser,
    addUser,
    addCredit,
    removeCredit,
    login,
    encript,
    decript
}
module.exports = funtions
