'use strict';

module.exports = {
  paypal: {
      businessEmail: '',
      url: 'https://www.sandbox.paypal.com/cgi-bin/webscr',
      currency: 'USD'
  },
  secret: 'wfefef',
  name: 'nodeStore',
  db: {
      url: 'mongodb://localhost:27017/products',
      sessions: 'sessions'
  },
  locale: {
      lang: 'en-US',
      currency: 'USD'
  }
};
