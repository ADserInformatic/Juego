const carta = require('../modelos/carta')
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'ADserTruco';
const getCards = async (req, res) => {
    const cards = await carta.find({})
    try {
        res.json({
            error: false,
            data: cards,
            mensaje: 'La solicitud fue exitosa'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `Error: ${e}`
        })
    }
}

const saveCard = async (req, res) => {
    const { name, valor } = req.body
    const guardar = await carta.create({ name, valor })
    try {
        res.json({
            error: false,
            data: guardar,
            mensaje: 'Se guardó correctamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `Error: ${e}`
        })
    }
}
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.json({
            error: true,
            mensaje: "No enviaron token"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.json({
                error: true,
                mensaje: "invalid token"
            });
        }

        req.user = user;
        next();
    });
}
module.exports = { saveCard, getCards }