const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'ADserTruco';
const { getSalas, getSala, saveSala, deleteSala, addUser } = require('../controlers/sala')

router.get('/S/:id', authenticateToken, getSalas)

router.get('/:id', authenticateToken, getSala)

router.post('', authenticateToken, saveSala)

router.delete('/:id', authenticateToken, deleteSala)

router.put('/:id', authenticateToken, addUser)
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