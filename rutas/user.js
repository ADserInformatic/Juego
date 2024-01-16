const express = require('express');
const router = express.Router();
const {getUser, saveUser} = require('../controlers/user')

router.get('', getUser)

router.post('', saveUser)

module.exports = router