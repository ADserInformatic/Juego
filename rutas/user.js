const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'ADserTruco';
const controlersUsers = require('../controlers/user')

router.get('/getUser/:id', authenticateToken, controlersUsers.getUser)
router.get('/getUsers', authenticateToken, controlersUsers.getUsers)
router.post('/addUser', authenticateToken, controlersUsers.addUser);
router.put('/addCredit/:id', authenticateToken, controlersUsers.addCredit)
router.put('/removeCredit/:id', authenticateToken, controlersUsers.removeCredit)
router.post('/login', controlersUsers.login)
router.put('/changePass/:id', authenticateToken, controlersUsers.changePass)
router.put('/clearEarning/:id', authenticateToken, controlersUsers.clearEarnings)
router.get('/earningHistory/:id', authenticateToken, controlersUsers.getEarningHistory)
router.get('/dataAdmin/:id', authenticateToken, controlersUsers.getAdmin)
router.get('/chargeHistory/:id', authenticateToken, controlersUsers.getChargeHistory)
router.put('/resetPass/:id', authenticateToken, controlersUsers.resetPass)
router.delete('/deleteUser/:id', authenticateToken, controlersUsers.deleteUser)




/* // Generar el token
const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
res.json({ token }); */

// Middleware para proteger rutas
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


module.exports = router