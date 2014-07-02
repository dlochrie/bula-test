var authenticate = require('./authenticate');
var seed = require('./seed');


/**
 * Expose the Test module.
 * @export
 */
module.exports = Test;



/**
 * Testing module main constructor. Attaches a reference to required libraries.
 * @param {express.app} app Express App instance.
 * @constructor
 */
function Test(app) {
  app.session =
  app.test_ = {
    authenticate: authenticate,
    seed: seed
  };
}
