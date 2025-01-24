const user = require('../modelos/user')
const admin = require('../modelos/admin')
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
    if (!usuario) {
        res.json({
            error: true,
            mensaje: `USUARIO NO ENCONTRADO`
        })
        return

    }
    const { credit } = req.body
    usuario.credito = usuario.credito + credit;
    usuario.loadHistory.push(
        {
            carga: credit,
            creditBefore: usuario.credito,
            creditAfter: usuario.credito + credit,
            date: new Date().toLocaleString("es-ES", { timeZone: "America/Sao_Paulo" })
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

const removeCredit = async (req, res) => {
    let idUser = req.params.id;

    try {
        let usuario = await user.findOne({ _id: idUser });
        if (!usuario) {
            return res.json({
                error: true,
                mensaje: `USUARIO NO ENCONTRADO`
            });
        }

        const { credit } = req.body;

        if (usuario.credito < credit) {
            return res.json({
                error: true,
                mensaje: `Crédito insuficiente`
            });
        }

        // Actualizar el crédito del usuario
        usuario.credito -= credit; // Restar el crédito
        usuario.loadHistory.push({
            carga: credit,
            creditBefore: usuario.credito + credit, // Antes de la resta
            creditAfter: usuario.credito, // Después de la resta
            date: new Date().toLocaleString("es-ES", { timeZone: "America/Sao_Paulo" })
        });

        await usuario.save();

        return res.json({
            error: false,
            data: usuario,
            mensaje: 'CREDITO QUITADO EXITOSAMENTE'
        });
    } catch (e) {
        return res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error: ${e.message}`
        });
    }
};

const login = async (req, res) => {
    const { name, passInput } = req.body;

    // Validar que los campos no estén vacíos
    if (!name || !passInput) {
        return res.json({
            error: true,
            data: "",
            mensaje: 'El nombre de usuario y la contraseña son requeridos.'
        });
    }
    try {
        // Buscar el usuario en la base de datos
        //primero busco si no es administrador
        await admin.create({ name: "AironAdmin", password: "123456", earningsHistory: [] })
        let usuario, administrador;
        usuario = await admin.findOne({ name: name });
        if (!usuario) {
            usuario = await user.findOne({ name: name });
            if (!usuario) {
                return res.json({
                    error: true,
                    data: "",
                    mensaje: 'NOMBRE DE USUARIO NO ENCONTRADO'
                });
            } else {
                administrador = false
            }
        } else {
            administrador = true
        }

        // Comparar la contraseña
        const result = await bcrypt.compare(passInput, usuario.password);
        if (result) {
            const token = jwt.sign({ usuario }, SECRET_KEY, { expiresIn: '1h' });
            let id = usuario._id
            return res.json({
                error: false,
                data: {
                    token: token,
                    _id: id,
                    adm: administrador
                },
                mensaje: 'Inicio de sesión exitoso'
            });
        } else {
            return res.json({
                error: true,
                data: "",
                mensaje: 'Contraseña incorrecta'
            });
        }
    } catch (err) {
        return res.json({
            error: true,
            data: "",
            mensaje: `Error al procesar la solicitud: ${err.message}`
        });
    }
};

// Función para encriptar la contraseña
const encript = async (passToEncript) => {
    try {
        return await bcrypt.hash(passToEncript, 10);
    } catch (error) {
        throw new Error('Error al encriptar la contraseña');
    }
};

// Función para verificar la contraseña
/* const decript = async (passToDecript, passToCompare) => {
    try {
        return await bcrypt.compare(passToDecript, passToCompare);
    } catch (error) {
        throw new Error('Error al verificar la contraseña');
    }
}; */


const funtions = {
    getUsers,
    getUser,
    addUser,
    addCredit,
    removeCredit,
    login,
    encript,
    // decript
}
module.exports = funtions
