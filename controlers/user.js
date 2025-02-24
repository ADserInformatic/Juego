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
    try {
        let id = req.params.id
        const userX = await user.findOne({ _id: id })
        if (userX) {
            res.json({
                error: false,
                data: userX,
                mensaje: 'La solicitud ha sido resuelta exitosamente'
            })
        } else {
            const adminX = await admin.findOne({ _id: id })

            if (adminX) {
                res.json({
                    error: false,
                    data: adminX,
                    mensaje: 'La solicitud ha sido resuelta exitosamente'
                })
            } else {
                res.json({
                    error: true,
                    mensaje: `No se encuentra el usuario`
                })
            }
        }

    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}
const getAdmin = async (req, res) => {
    try {
        let id = req.params.id
        const userX = await admin.findOne({ _id: id })
        if (!userX) {
            res.json({
                error: true,
                mensaje: `No se encuentra el usuario administrador`
            })
        }
        const data = {
            name: userX.name,
            earning: userX.earning
        }
        res.json({
            error: false,
            data: data,
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
        return res.json({
            error: true,
            mensaje: 'El nombre y el crédito son requeridos.'
        });
    }

    let CreditBefore = 0;
    let CreditAfter = credito;
    let password;
    try {
        password = await bcrypt.hash('123456Aa', 10);// Hasheo la contraseña
    } catch (error) {
        throw new Error('Error al encriptar la contraseña');
    }
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
const changePass = async (req, res) => {
    const { passOld, passNew } = req.body;

    // Validar que los campos no estén vacíos
    if (!passOld || !passNew) {
        return res.json({
            error: true,
            data: "",
            mensaje: 'Faltan datos requeridos.'
        });
    }
    try {
        const id = req.params.id;
        let usuario, administrador, passHashed;
        usuario = await admin.findOne({ _id: id });
        if (!usuario) {
            usuario = await user.findOne({ _id: id });
            if (!usuario) {
                return res.json({
                    error: true,
                    data: "",
                    mensaje: 'ID DE USUARIO NO ENCONTRADO'
                });
            } else {
                administrador = false //por las dudas guardo q es un usuario normal...aun no se usa
            }
        } else {
            administrador = true //por las dudas guardo q es un administrador...aun no se usa
        }
        // Comparar la contraseña
        const result = await bcrypt.compare(passOld, usuario.password);
        if (result) {
            passHashed = await bcrypt.hash(passNew, 10);// Hasheo la contraseña
            usuario.password = passHashed;
            usuario.save();
            res.json({
                error: false,
                data: usuario,
                adm: administrador,
                mensaje: 'CONTRASEÑA CAMBIADA EXITOSAMENTE'
            });
        }
        else {
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

}
const clearEarnings = async (req, res) => {
    const { id } = req.params;
    const { monto, comentario, password } = req.body;
    //validar password
    const adminTruth = await bcrypt.hash('ADserTruco', 10);
    const truth = await bcrypt.compare(password, adminTruth);
    if (!truth) {
        return res.json({
            error: true,
            mensaje: 'Contraseña incorrecta'
        });
    }
    // Validar monto
    if (!monto) {
        return res.json({
            error: true,
            mensaje: 'No hay monto agregado' // no puso monto
        });
    }

    try {
        // Buscar administrador
        const admin = await admin.findOne({ _id: id });
        if (!admin) {
            return res.json({
                error: true,
                mensaje: 'Faltan datos requeridos.' // no encuentra el id del administrador
            });
        }

        // Validar que el monto no exceda las ganancias
        if (monto > admin.earning) {
            return res.json({
                error: true,
                mensaje: 'Monto agregado mayor a ganancias.' // el monto agregado es mayor a las ganancias 
            });
        }

        // Actualizar ganancias
        admin.earning -= monto;
        await admin.save();

        // Crear registro
        const registro = {
            monto,
            fecha: new Date().toLocaleString("es-ES", { timeZone: "America/Sao_Paulo" }),
            comentario
        };

        return res.json({
            error: false,
            data: admin.earning,
            mensaje: "Solicitud procesada con éxito"
        });
    } catch (error) {
        return res.json({
            error: true,
            mensaje: 'Error al procesar la solicitud.'
        });
    }
};
const getEarningHistory = async (req, res) => {
    try {
        let id = req.params.id
        const userX = await admin.findOne({ _id: id })
        if (!userX) {
            res.json({
                error: true,
                mensaje: `No se encuentra el usuario administrador`
            })
        }
        res.json({
            error: false,
            data: userX.earningsHistory,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}
const getChargeHistory = async (req, res) => {
    try {
        let id = req.params.id
        const userX = await user.findOne({ _id: id })
        if (!userX) {
            res.json({
                error: true,
                mensaje: `No se encuentra el usuario`
            })
        }
        res.json({
            error: false,
            data: userX.loadHistory,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}
const funtions = {
    getUsers, //devuelve todos los apostadores
    getUser,//devuelve un apostador en particular con un id
    addUser,//agrega un apostador
    addCredit,//carga credito a un apostador
    removeCredit,//quita credito a un apostador
    login,//login de apostador o administrador
    changePass,//cambia la contraseña del apostador o administrador
    clearEarnings, //para bajar ganancia
    getAdmin, //devuelve los datos del administrador
    getEarningHistory, //devuelve el historial de ganancias de administrador
    getChargeHistory, //devuelve el historial de cargas de un usuario

}
module.exports = funtions
