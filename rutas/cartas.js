const express = require('express')
const router = express.Router()
const {saveCard, getCards} = require('../controlers/carta')

router.get('', getCards)

router.post('', saveCard)

module.exports = router