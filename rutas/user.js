const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'ADserTruco';
const controlersUsers = require('../controlers/user')

router.get('/getUser/:id', controlersUsers.getUser)
router.get('/getUsers', controlersUsers.getUsers)
router.post('/addUser', controlersUsers.addUser);
router.put('/addCredit/:id', controlersUsers.addCredit)
router.put('/removeCredit/:id', controlersUsers.removeCredit)
router.post('/login', controlersUsers.login)
router.put('/changePass/:id', controlersUsers.changePass)


/* // Generar el token
const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
res.json({ token }); */

// Middleware para proteger rutas
function authenticateToken(req, res, next) {
               const token = req.headers['authorization']?.split(' ')[1];

               if (!token) return res.sendStatus(401);

               jwt.verify(token, SECRET_KEY, (err, user) => {
                              if (err) return res.sendStatus(403);
                              req.user = user;
                              next();
               });
}


module.exports = router