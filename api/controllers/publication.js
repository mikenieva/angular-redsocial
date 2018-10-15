const path = require('path');
const fs = require('fs');
const moment = require('moment');
const mongoosePaginate = require('mongoose-pagination');

const Publication = require('../models/publication');
const User = require('../models/user');
const Follow = require('../models/follow');

const probando = (req, res) => {
    res.status(200).send({
        message: "Hola desde el controlador de publicaciones"
    })
}

const savePublication = (req, res) => {
    let params = req.body;

    if(!params.text) return res.status(200).send({message: 'Debes enviar un texto'});
    
    let publication = new Publication();
    publication.text = params.text;
    publication.file = 'null';
    publication.user = req.user.sub;
    publication.created_at = moment().unix();

    publication.save((err, publicationStored) => {
        if(err) return res.status(500).send({message: 'Error al guardar la publicación'});

        if(!publicationStored) return res.status(404).send({message: 'La publicación no ha sido guardado'});

        return res.status(200).send({publicationStored});
    })
}

const getPublications = (req, res) => {
    let page = 1;
    if(req.params.page){
        page = req.params.page;
    }

    let itemsPerPage = 4;

    Follow.find({user: req.user.sub}).populate('followed').exec((err, follows)=>{
        if(err) return res.status(500).send({message: 'Error devolver el seguimiento'});

        let follows_clean = [];

        follows.forEach((follow) => {
            follows_clean.push(follow.followed);
        });

        Publication.find({user: {"$in": follows_clean }}).sort('-created_at').populate('user').paginate(page, itemsPerPage, (err, publications, total) => {
            if(err) return res.status(500).send({message: 'Error al devolver publicaciones'});

            if(!publications) return res.status(404).send({message: 'No hay publicaciones'});

            return res.status(200).send({
                total_items: total,
                pages: Math.ceil(total/itemsPerPage),
                page: page,
                publications
            })
        })

    }) 
}

const getPublication = (req, res) => {
    let publicationId = req.params.id;

    Publication.findById(publicationId, (err,publication) => {
        if(err) return res.status(500).send({message: 'Error al devolver publicaciones'});

        if(!publication) return res.status(404).send({message: 'No existe la publicación'});

        res.status(200).send({publication});
    })
}

const deletePublication = (req, res) => {
    let publicationId = req.params.id;

    Publication.find({'user': req.user.sub, '_id': publicationId}).remove(err => {
        if(err) return res.status(500).send({message: 'Error al borrar publicaciones'});

        return res.status(200).send({message: 'Publicación eliminada'});
    })
}


// Subir imágenes 

const uploadImage = (req, res) => {
    let publicationId = req.params.id;

    if(req.files){
        let file_path = req.files.image.path;
        let file_split = file_path.split('/')
        let file_name = file_split[2];
        let ext_split = file_name.split('\.');
        let file_ext = ext_split[1];

        if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif' || file_ext == 'PNG' || file_ext == 'JPG' || file_ext == 'JPEG' || file_ext == 'GIF'  ){
            
            Publication.findOne({'user': req.user.sub, '_id': publicationId}).exec((err, publication) => {
                console.log(publication);
                if(publication){
                    // Actualizar documento de publicación
                    Publication.findByIdAndUpdate(publicationId, {file: file_name}, {new: true}, (err, publicationUpdated) =>{
                        if(err) return res.status(500).send({message: 'Error en la petición'});

                        if(!publicationUpdated) return res.status(404).send({message: 'No se ha podido actualizar el usuario'});

                        return res.status(200).send({publication: publicationUpdated});
                    })
                } else {
                    return removeFilesOfUploads(res, file_path, 'No tiene permiso para actualizar esta publicación');

                }
            })

        } else {
            return removeFilesOfUploads(res, file_path, 'Extensión no válida');
        }

        } else {
            return res.status(200).send({message: 'No se han subido archivos'});
        }
}

const removeFilesOfUploads = (res, file_path, message) => {
    fs.unlink(file_path, (err) => {
        return res.status(200).send({message: message});
    });
}

const getImageFile = (req, res) => {
    let imageFile = req.params.imageFile;
    let path_File = './uploads/publications/' + imageFile;
    
    fs.exists(path_File, (exists) => {
        if(exists){
            res.sendFile(path.resolve(path_File));
        } else{
            res.status(200).send({message: 'No existe la imagen'});
        }
    })
}

module.exports = { probando, savePublication, getPublications, getPublication, deletePublication, uploadImage, getImageFile };