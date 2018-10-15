const moment = require('moment');
const mongoosePaginate = require('mongoose-pagination');

const User = require('../models/user');
const Follow = require('../models/follow');
const Message = require('../models/message');

const probando = (req, res) => {
    res.status(200).send({message: 'Hola mike nieva'})
}

const saveMessage = (req, res) => {
    let params = req.body;

    if(!params.text || !params.receiver){ res.status(200).send({message: 'Envia los datos necesarios'}) }

    let message = new Message();

    message.emitter = req.user.sub;
    message.receiver = params.receiver;
    message.text = params.text;
    message.created_at = moment().unix();
    message.viewed = 'false';

    message.save((err, messageStored) => {
        if(err) res.status(500).send({message: 'Error en la petición'});
        if(!messageStored)res.status(500).send({message: 'Error al enviar el mensaje'});

        return res.status(200).send({message: messageStored});

    })
}

const getReceivedMessages = (req, res) => {
    let userId = req.user.sub;

    let page = 1;

    if(req.params.page){
        page = req.params.page;
    }

    let itemsPerPage = 4;

    Message.find({receiver: userId}).populate('emitter', 'name surname image nick _id').paginate(page, itemsPerPage, (err, messages, total) => {
        if(err) res.status(500).send({message: 'Error en la petición'});
        if(!messages) res.status(404).send({message: 'No hay mensajes'});

        return res.status(200).send({
            total,
            pages: Math.ceil(total/itemsPerPage),
            messages
        })
    });
}

const getEmmitMessages = (req, res) => {
    let userId = req.user.sub;

    let page = 1;

    if(req.params.page){
        page = req.params.page;
    }

    let itemsPerPage = 4;

    Message.find({emitter: userId}).populate('emitter receiver', 'name surname image nick _id').paginate(page, itemsPerPage, (err, messages, total) => {
        if(err) res.status(500).send({message: 'Error en la petición'});
        if(!messages) res.status(404).send({message: 'No hay mensajes'});

        return res.status(200).send({
            total,
            pages: Math.ceil(total/itemsPerPage),
            messages
        })
    });
}

const getUnviewedMessages = (req, res) => {
    let userId = req.user.sub;

    Message.count({receiver: userId, viewed: 'false'}).exec((err, count) => {
        if(err) res.status(500).send({message: 'Error en la petición'});
        return res.status(200).send({
            'unviewed': count
        })
    })
}

const setViewedMessages = (req, res) => {
    let userId = req.user.sub;
    
    Message.update({receiver: userId, viewed: 'false'}, { viewed: 'true'}, { "multi": true }, (err, messagesUpdated) => {
        if(err) res.status(500).send({message: 'Error en la petición'});
        return res.status(200).send({
            messages: messagesUpdated
        })
    })
}

module.exports = {
    probando,
    saveMessage,
    getReceivedMessages,
    getEmmitMessages,
    getUnviewedMessages,
    setViewedMessages
}