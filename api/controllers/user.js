const fs = require('fs');
const path = require('path');

const User = require('../models/user');
const Follow = require('../models/follow')
const Publication = require('../models/publication');

const bcrypt = require('bcrypt-nodejs');
const jwt = require('../services/jwt');
const mongoosePaginate = require('mongoose-pagination');

// Métodos de prueba
const home = (req, res) => {
    res.status(200).send({
        message: 'Hola mundo'
    })
}

const pruebas = (req, res) => {
    console.log(req.body);
    res.status(200).send({
        message: ' Acción de pruebas en el servidor de Nodejs'
    })
}

// Registro
const saveUser = (req, res) => {
    let params = req.body;
    let user = new User();
    if(params.name && params.surname && params.nick && params.email && params.password){
        user.name = params.name;
        user.surname = params.surname;
        user.nick = params.nick;
        user.email = params.email;
        user.role = 'ROLE_USER';
        user.image = null;

        // Contorlar usuarios duplicados
        User.find({ $or: 
            [
                {email: user.email.toLowerCase()},
                {nick: user.nick.toLowerCase()}
            ]}).exec((err, users) => {
                if(err) return res.status(500).send({message: 'Error al guardar el usuario'});
                
                if(users && users.length >=1){
                    return res.status(200).send({message: 'El usuario que intentas registrar existe'})
                } else {
                    // Cifra la password y me guarda los datos
                    bcrypt.hash(params.password, null, null, (err, hash) => {
                        user.password = hash;
                        user.save((err, userStored) => {
                            if(err) return res.status(500).send({message: 'Error al guardar el usuario'});
                            if(userStored){
                                res.status(200).send({user: userStored});
                            } else {
                                res.status(404).send({message: 'No se ha registrado el usuario'});
                            }
                        });
                    });
                }
            });
            
    } else {
        res.status(200).send({
            message: "Envía todos los campos necesarios"
        })
    }
}


// Login
const loginUser = (req, res) => {
    let params = req.body;
    let email = params.email;
    let password= params.password;

    
    User.findOne({email: email}, (err,user) => {
        if(err) return res.status(500).send({message: 'Error en la petición'})
        if(user){
            bcrypt.compare(password, user.password, (err, check) => {
                if(check){
                    // devolver datos de usuario
                    if(params.gettoken){
                        //generar y devolver token
                        return res.status(200).send({
                            token: jwt.createToken(user)
                        })
                    } else{
                        //devolver datos de usuario
                        user.password = undefined;
                        return res.status(200).send({user})
                    }
                    
                } else {
                    return res.status(404).send({message: 'El usuario no se ha podido identificar'})
                }
            })
        } else{
            return res.status(404).send({message: 'El usuario no se ha podido identificar!'})
        }
    });
}

// Conseguir datos de un usuario

const getUser = (req, res) => {
    let userId = req.params.id;

    User.findById(userId, (err,user) => {
        if(err) return res.status(500).send({message: 'Error en la petición'});
        if(!user) return res.status(404).send({message: 'El usuario no existe'})

        followThisUser(req.user.sub, userId).then((value) => {
            user.password = undefined;

            return res.status(200).send({user, 
                following: value.following, 
                followed: value.followed
            });
        })
    });
}

const followThisUser = async (identity_user_id, user_id) => {
    try {
        let following = await Follow.findOne({ user: identity_user_id, followed: user_id})
        .then(following => following)
        .catch(err => handleerror(err));

        let followed = await Follow.findOne({ user: user_id, followed: identity_user_id})
        .then(followed => followed)
        .catch(err => handleerror(err));

        return {
            following,
            followed
        }
    } catch(e){
        console.log(e);
    }
}


// Devolver un listado de usuarios paginados

const getUsers = (req, res) => {
    let identity_user_id = req.user.sub;
    
    let page = 1;

    if(req.params.page){
        page = req.params.page;
    }

    let itemsPerPage = 5;

    User.find().sort('_id').paginate(page, itemsPerPage, (err,users, total) => {
        
        if(err) return res.status(500).send({message: 'Error en la petición'});

        if(!users) return res.status(404).send({message: 'No hay usuarios disponibles'});

        followUserIds(identity_user_id).then((value) => {
            console.log(value);
            return res.status(200).send({
                users,
                users_following: value.following,
                users_follow_me: value.followed,
                total,
                pages: Math.ceil(total/itemsPerPage)
            });
        }) 
    });
}

const followUserIds = async (user_id) => {

    let following = await Follow.find({"user": user_id}).select({'_id':0, '__v': 0, 'user':0})
    .then(follows => {
        let follows_clean = [];
        follows.forEach(follow => {
            follows_clean.push(follow.followed);
        });
        return follows_clean;
    });

    let followed = await Follow.find({"followed": user_id}).select({'_id':0, '__v': 0, 'followed':0})
    .then(follows => {
        let follows_clean = [];
        follows.forEach(follow =>{
            follows_clean.push(follow.user);
        });
        return follows_clean;
    });

    return {
        following: following,
        followed: followed
    }
}


const getCounters = (req, res) => {
    let userId = req.user.sub;
    if(req.params.id){
        userId = req.params.id;      
    }
    getCountFollow(userId).then((value) => {
        return res.status(200).send(value);
    })
}

const getCountFollow = async (user_id) => {
    try{
        // Lo hice de dos formas. Uno con callback de countDocuments y el otro con una promesa. Ambos funcionan.
        let following = await Follow.countDocuments({"user": user_id},(err, result) => { return result });
        let followed = await Follow.countDocuments({"followed": user_id}).then(count => count);
        let publications = await Publication.countDocuments({"user": user_id}).then(count => count);

        return { following, followed, publications }

    } catch(e){
        console.log(e);
    }
}



const updateUser = (req, res) => {
    let userId = req.params.id;
    let update = req.body;
    
    // Borrar propiedad password del objeto
    delete update.password;

    // Evitamos que un usuario actualice a otro usuario
    if(userId != req.user.sub){
        return res.status(500).send({message: 'No tienes permiso para actualizar los datos de usuario'});
    }

    User.find({ $or: [
        {email: update.email.toLowerCase()},
        {nick: update.nick.toLowerCase()}
    ]}).exec((err, users) => {
        var user_isset = false;
        users.forEach((user) => {
            if(user && user._id != userId) user_isset = true
        })

        if(user_isset) return res.status(404).send({message: 'Los datos ya están en uso'});
        
        User.findByIdAndUpdate(userId, update, {new: true}, (err, userUpdated) => {
            if(err) return res.status(500).send({message: 'Error en la petición'});
    
            if(!userUpdated) return res.status(404).send({message: 'No se ha podido actualizar el usuario'});
    
            return res.status(200).send({user: userUpdated});
     
        })

    })

    
}

const uploadImage = (req, res) => {
    let userId = req.params.id;

    if(req.files){
        let file_path = req.files.image.path;
        console.log('file_path: ', file_path);
        let file_split = file_path.split('/')
        
        let file_name = file_split[2];
        console.log('file_name: ', file_name);

        let ext_split = file_name.split('\.');
        console.log('ext_split: ', ext_split);

        let file_ext = ext_split[1];
        console.log('file_ext: ', file_ext);

        // Evitamos que un usuario suba otra imagen a otro usuario
        if(userId != req.user.sub){
            return removeFilesOfUploads(res, file_path, 'No tienes permiso para actualizar los datos de usuario');
        }

        if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif' || file_ext == 'PNG' || file_ext == 'JPG' || file_ext == 'JPEG' || file_ext == 'GIF'  ){
            // Actualizar documento de usuario logueado
            User.findByIdAndUpdate(userId, {image: file_name}, {new: true}, (err, userUpdated) =>{
                if(err) return res.status(500).send({message: 'Error en la petición'});

                if(!userUpdated) return res.status(404).send({message: 'No se ha podido actualizar el usuario'});

                return res.status(200).send({user: userUpdated});
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
    let path_File = './uploads/users/' + imageFile;
    
    fs.exists(path_File, (exists) => {
        if(exists){
            res.sendFile(path.resolve(path_File));
        } else{
            res.status(200).send({message: 'No existe la imagen'});
        }
    })
}

module.exports = {
    home,
    pruebas,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    getCounters,
    updateUser,
    uploadImage,
    getImageFile
}