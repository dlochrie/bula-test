/**
 * Expose 'Authenticate' module.
 */
module.exports = Authenticate;



/**
 * Create a mock session class and expose it to `app`.
 * @constructor
 */
function Authenticate() {
  this.logged_in = true;
  this.passport = app.response.locals = {
    user: Authenticate.DEFAULT_TESTING_USER_
  };
}


/**
 * Default User for Tests.
 * @enum
 * @private
 */
Authenticate.DEFAULT_TESTING_USER_ = {
  id: 1,
  displayName: 'Testing Tester',
  slug: 'testing-tester',
  email: 'testing.tester@email.com',
  created: '2014-06-15T20:47:59.000Z',
  updated: '2014-06-15T20:47:59.000Z'
};
