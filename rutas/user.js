const express = require('express');
const router = express.Router();
const { addCredit, getUser, saveUser, addUser } = require('../controlers/user')

router.get('', getUser)

router.post('', saveUser)
router.post('/addUser', addUser);
router.put('/addCredit/:id', addCredit)

module.exports = router