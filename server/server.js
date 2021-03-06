require("./config/config");

const _ = require('lodash');
const express = require('express');
var bodyParser = require('body-parser');
var { ObjectID } = require('mongodb');

var { mongoose } = require('./db/mongoose');
var { Todo } = require('./models/todo');
var { User } = require('./models/user');
var { authenticate } = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.get('/users/currentuser',authenticate,(req, resp) => {
  resp.send(req.user);
});

//------------------get all todos of a user------------------
app.get('/todos',authenticate, (req,resp) => {
  Todo.find({_userId : req.user._id}).then((todos) => {
    resp.send({todos});
  },(err) => {
    resp.status(400).send();
  });
});

//----------------create new todo(s)--------------------
app.post('/todos/new', authenticate,(req, resp) => {
  var todo = new Todo({
    text: req.body.text,
    _userId: req.user._id
  });

  todo.save().then((doc) => {
    resp.send(doc);
  }, (err) => {
    resp.status(400).send();
  });

});

//--------------get a single todo by id--------------
app.get('/todos/:id', authenticate,(req,resp) => {
  var _id = req.params.id;
  if (!ObjectID.isValid(_id)) {
    return resp.status(404).send('Invalid ID!');
  }

  Todo.findOne({
    _id,
    _userId: req.user._id
    }).then((todo) => {
    if (!todo) {
      return resp.status(404).send('Unable to find todo id');
    }
    resp.send({todo});
  }).catch((err) => {
    resp.status(400).send(err);
  });

});

//-------------------Update a todo------------------------------
app.patch('/todos/:id', authenticate, (req,resp) => {
  var _id = req.params.id;
  var body = _.pick(req.body, ['text','completed']); //security

  if (!ObjectID.isValid(_id)) {
    return resp.status(404).send();
  }

  if (_.isBoolean(body.completed) && body.completed) {
    body.completedAt = new Date().getTime();
  } else {
    body.completed = false;
    body.completedAt = null;
  }

  Todo.findOneAndUpdate({
    _id,
    _userId: req.user._id
    }, {$set: body}, {new:true}).then((todo) =>{
    if (!todo) {

      return resp.status(404).send();
    }

    resp.status(200).send({todo});
  }).catch((err) => {
    resp.status(400).send();
  });

});

//----------------remove a single todos-----------------
app.delete('/todos/:id',authenticate, (req, resp) => {
  var _id = req.params.id
  if (!ObjectID.isValid(_id)) {
    return resp.status(404).send("In valid ID");
  }

  Todo.findOneAndRemove({
    _id,
    _userId: req.user._id
    }).then((todo) => {
    if (!todo) {
      return resp.status(404).send('Todo not found');
    }
    return resp.status(200).send({todo});
  }).catch((err) => {
    resp.status(400).send();
  });

});

//-------------Todo--/\-----User-\/-------------------

//-------------New user-------------------------------
app.post('/users/new', (req,resp) => {
  var body = _.pick(req.body, ['email','password']);
  var user = new User(body);

  user.save().then((user) => {
    return user.generateAuthToken();
  }).then(( token) => {
    resp.status(200).header('x-auth',token).send(user);
  }).catch((err) => {
    resp.status(400).send(err);
  });
});
//-------------New user----------------------------------

//--------------------user login-------------------------
app.post('/users/login', (req, resp) => {
  var body = _.pick(req.body, ['email','password']);
  var user = new User(body);

  User.findByLogin(body.email, body.password).then((user) => {
    return user.generateAuthToken().then((token) => {
      resp.header('x-auth',token).send(user);
    })
  }).catch((e) => {
    resp.status(400).send();
  });
})
//--------------------User login-------------------------
//-------------------User logout----------------------
app.delete('/users/currentuser/logout',authenticate, (req, resp) => {
  req.user.removeToken(req.token).then(() => {
    resp.status(200).send();
  },() => {
    resp.status(400).send();
  });
});
//-------------------User logout----------------------
//--------------------User-/\----------------------------


app.listen(port, () => {
  console.log(`Started on port ${port}`);
});

module.exports = { app };
