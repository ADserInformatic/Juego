const express = require('express')
const router = express.Router()
const {getSalas, getSala, saveSala, deleteSala, addUser} = require('../controlers/sala')

router.get('', getSalas)

router.get('/:id', getSala)

router.post('', saveSala)

router.delete('/:id', deleteSala)

router.put('/:id', addUser)


module.exports = router