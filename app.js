'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 8080;
const mongoose = require('mongoose');
const helmet = require('helmet');
const path = require('path');
const favicon = require('serve-favicon');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const app = express();
const config = require('./lib/config.js');
const morgan = require('morgan')

app.use(morgan('dev'));

mongoose.Promise = Promise;
mongoose.connect(config.db.url, {
    useMongoClient: true
});

const Products = require('./models/Products');
const Cart = require('./lib/Cart');
const Security = require('./lib/Security');
const States = require('./models/state');
const store = new MongoDBStore({
    uri: config.db.url,
    collection: config.db.sessions
});
const paypal = require('paypal-rest-sdk');
paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': 'Your Client ID',
    'client_secret': 'Your Client Secret'

    
});
app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('env', 'development');

app.locals.paypal = config.paypal;
app.locals.locale = config.locale;

app.use(favicon(path.join(__dirname, 'favicon.png')));
app.use('/public', express.static(path.join(__dirname, '/public'), {
  maxAge: 0,
  dotfiles: 'ignore',
  etag: false
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(helmet());
app.use(session({
    secret: config.secret,
    resave: false,
    saveUninitialized: true,
    unset: 'destroy',
    store: store,
    name: config.name + '-' + Security.generateId(),
    genid: (req) => {
        return Security.generateId()
    }
}));

app.get('/', (req, res) => {
  if(!req.session.cart) {
      req.session.cart = {
          items: [],
          totals: 0.00,
          formattedTotals: ''
      };
  }
  Products.find({price: {'$gt': 0}}).sort({price: -1}).limit(6).then(products => {
      let format = new Intl.NumberFormat(req.app.locals.locale.lang, {style: 'currency', currency: req.app.locals.locale.currency });
      products.forEach( (product) => {
         product.formattedPrice = format.format(product.price);
      });
      res.render('index', {
          pageTitle: 'Node.js Shopping Cart',
          products: products,
          nonce: Security.md5(req.sessionID + req.headers['user-agent'])
      });

  }).catch(err => {
      res.status(400).send('Bad request');
  });

});

app.get('/cart', (req, res) => {
    let sess = req.session;
    let cart = (typeof sess.cart !== 'undefined') ? sess.cart : false;
    res.render('cart', {
        pageTitle: 'Cart',
        cart: cart,
        nonce: Security.md5(req.sessionID + req.headers['user-agent'])
    });
});
app.get('/getstates',(req,res)=>{
  state.findOne({}).then(function (state) {
 res.render('checkout', {
 state: state
 });
 console.log('hello');

});
});
app.get('/cart/remove/:id/:nonce', (req, res) => {
   let id = req.params.id;
   if(/^\d+$/.test(id) && Security.isValidNonce(req.params.nonce, req)) {
       Cart.removeFromCart(parseInt(id, 10), req.session.cart);
       res.redirect('/cart');
   } else {
       res.redirect('/');
   }
});

app.get('/cart/empty/:nonce', (req, res) => {
    if(Security.isValidNonce(req.params.nonce, req)) {
        Cart.emptyCart(req);
        res.redirect('/cart');
    } else {
        res.redirect('/');
    }
});

app.post('/cart', (req, res) => {
    let qty = parseInt(req.body.qty, 10);
    let product = parseInt(req.body.product_id, 10);
    if(qty > 0 && Security.isValidNonce(req.body.nonce, req)) {
        Products.findOne({product_id: product}).then(prod => {
            let cart = (req.session.cart) ? req.session.cart : null;
            Cart.addToCart(prod, qty, cart);
            res.redirect('/cart');
        }).catch(err => {
           res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

app.post('/cart/update', (req, res) => {
    let ids = req.body["product_id[]"];
    let qtys = req.body["qty[]"];
    if(Security.isValidNonce(req.body.nonce, req)) {
        let cart = (req.session.cart) ? req.session.cart : null;
        let i = (!Array.isArray(ids)) ? [ids] : ids;
        let q = (!Array.isArray(qtys)) ? [qtys] : qtys;
        Cart.updateCart(i, q, cart);
        res.redirect('/cart');
    } else {
        res.redirect('/');
    }
});

app.get('/checkout', (req, res) => {
    let sess = req.session;
    let cart = (typeof sess.cart !== 'undefined') ? sess.cart : false;
    res.render('checkout', {
        pageTitle: 'Checkout',
        cart: cart,
        checkoutDone: false,
        nonce: Security.md5(req.sessionID + req.headers['user-agent'])
    });
});

app.post('/pay', (req, res) => {
    let sess = req.session;
    let cart = (typeof sess.cart !== 'undefined') ? sess.cart : false;
    console.log(cart.totals);

      const create_payment_json = {
     "intent": "sale",
     "payer": {
         "payment_method": "paypal"
     },
     "redirect_urls": {
         "return_url": "http://localhost:8080/success",
         "cancel_url": "http://localhost:8080/cancel"
     },
     "transactions": [{
	"amount": {
	"total": cart.totals,
	"currency": "USD"
	}

	}]

    }

  paypal.payment.create(create_payment_json, function (error, payment) {
          if (error) {
              throw error;
          } else {
              for (let i = 0; i < payment.links.length; i++) {
                  if (payment.links[i].rel === 'approval_url') {
                      res.redirect(payment.links[i].href);
                  }
              }
          }
      });

});

app.get('/success', (req, res) => {
  let sess = req.session;
  let cart = (typeof sess.cart !== 'undefined') ? sess.cart : false;
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;
    const execute_payment_json = {
        "payer_id": payerId,
        "transactions": [{
            "amount": {
                "currency": "USD",
                "total": cart.totals
            }
        }]
    };

    paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
            console.log(error.response);
            throw error;
        } else {
            console.log(JSON.stringify(payment));
            res.send('Success');
        }
    });
});

if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
  });
}

app.use((err, req, res, next) => {
  res.status(err.status || 500);
});

app.listen(port);
