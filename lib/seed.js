var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    Q = require('q');


/**
 * Expose 'Seed' module.
 */
module.exports = Seed;



/**
 * The Seed module populates fixtures for functional testing.
 * @param {express.app} app Express App instance.
 * @param {string} model The model on which to operate.
 * @param {?Array.<string>=} opt_dependencies Optional models required for this
 *     model to be tested.
 * @constructor
 */
function Seed(app, model, opt_dependencies) {
  /**
   * Instance of Node MySQL.
   * @type {Object}
   * @private
   */
  this.db_ = app.db;

  /**
   * Models/tables that this model requires for testing.
   * @type {?Array.<string>}
   * @private
   */
  this.dependencies_ = opt_dependencies || [];

  /**
   * The model on which to operate.
   * @type {string}
   * @private
   */
  this.model_ = model;

  /**
   * Default options for reading files. Reading as a utf-8-encoded string, as
   * opposed to raw binary, allows for proper sql queries.
   * @private
   */
  this.readOptions_ = {encoding: 'utf8'};

  /**
   * Path to fixtures/SQL scripts.
   * @type {string}
   * @private
   */
  this.root_ = app.get('ROOT PATH') + 'test/fixtures/';

  /**
   * Path to tables/SQL scripts.
   * @type {string}
   * @private
   */
  this.tablesDir_ = app.get('ROOT PATH') + 'examples/sql/';
}


/**
 * Locates the sql for and creates the model's table (if it does not exist).
 * @param {!string} model The model to create the table for.
 * @private
 * @return {Q.promise} Promise to be resolved by caller.
 */
Seed.prototype.createTable_ = function(model) {
  var file = this.tablesDir_ + model + '.sql',
      sql = this.readSqlFromFile_(file);

  // TODO: Will `Q.all` throw a fit if the promise was null?
  return sql ? this.executeSQL_(sql, Seed.DEFAULT_CREATE_TABLE_ERROR_) : null;
};


/**
 * Process the SQL Query.
 * @param {string} sql The raw SQL to process.
 * @param {string=} opt_message Optional message to pass for displaying errors.
 * @private
 * @return {Q.promise} Promise to be resolved by caller.
 */
Seed.prototype.executeSQL_ = function(sql, opt_message) {
  var message = opt_message || Seed.DEFAULT_QUERY_ERROR_;
  var deferred = Q.defer();
  this.db_.getConnection(function(err, connection) {
    if (err) {
      deferred.reject(new Error(util.format(message, sql, err)));
    } else {
      connection.query(sql, function(err, result) {
        connection.release();
        if (err) {
          deferred.reject(new Error(util.format(message, sql, err)));
        } else {
          deferred.resolve();
        }
      });
    }
  });
  return deferred.promise;
};


/**
 * Gets the basename for a file based on its extension.
 * @param {?string} filename Name of file to get basename for.
 * @private
 * @return {string} Basename of the file.
 */
Seed.prototype.getBaseName_ = function(filename) {
  var basename = (filename || '').replace(Seed.BASE_FILENAME_REGEX_, '');
  return path.basename(basename, '.sql').toLowerCase();
};


/**
 * Determines whether the script is a setup or teardown SQL script, based on
 * filename extension.
 * @param {?string} filename Name of file to test.
 * @private
 * @return {boolean} Whether the script is a setup or teardown script.
 */
Seed.prototype.isSetup_ = function(filename) {
  return (filename || '').toLowerCase().match(Seed.SETUP_FILE_REGEX_);
};


/**
 * Gets the raw SQL from the script by reading it as a UTF-8-encoded string.
 * @param {string} file Full path to the file to read.
 * @private
 * @return {string} The raw SQL data.
 */
Seed.prototype.readSqlFromFile_ = function(file) {
  return fs.lstatSync(file).isFile() ?
      fs.readFileSync(file, this.readOptions_) : null;
};


/**
 * Seeds or tears down the fixtures for a model.
 * @param {!string} model Name of model to seed or truncate.
 * @param {boolean} seed Whether to seed or truncate.
 * @private
 * @return {Q.promise} Promise to be resolved by caller.
 */
Seed.prototype.seedOrTearDown_ = function(model, seed) {
  var files = fs.readdirSync(this.root_),
      self = this;

  var deferred = Q.defer();
  files.forEach(function(fixture) {
    if (self.getBaseName_(fixture) === model) {
      fixture = self.root_ + fixture;
      var data = self.readSqlFromFile_(fixture);
      // If seed is `true`, then seed, if not, teardown.
      var isFixture = seed ? self.isSetup_(fixture) : !self.isSetup_(fixture);
      if (isFixture) {
        self.executeSQL_(data).then(function() {
          deferred.resolve();
        }, function(err) {
          deferred.reject(new Error('There was an error:\t', err));
        });
      }
    }
  });
  return deferred.promise;
};


/**
 * Sets up the tables and fixture data for each required model in a test.
 * @param {Function} done Callback function to fire when done.
 */
Seed.prototype.setup = function(done) {
  var queue = [],
      self = this;
  var models = [].concat(this.model_, this.dependencies_);

  // Schedule the creation and seeding of each model/table, but defer
  // execution.
  models.forEach(function(model) {
    queue.push(self.createTable_(model));
    queue.push(self.seedOrTearDown_(model, true));
  });

  // Execute in order.
  Q.all(queue).then(function(queries) {
    done();
  });
};


/**
 * Tears down (trucates) the tables for each required model in a test.
 * @param {Function} done Callback function to fire when done.
 */
Seed.prototype.teardown = function(done) {
  var queue = [],
      self = this;
  var models = [].concat(this.model_, this.dependencies_);

  // Schedule the teardown of each model/table, but defer
  // execution.
  models.forEach(function(model) {
    queue.push(self.seedOrTearDown_(model, false));
  });

  // Execute in order.
  Q.all(queue).then(function(queries) {
    done();
  });
};


/**
 * Base name of file, less the `setup` or `teardown` suffix.
 * @const
 * @type {RegExp}
 * @private
 */
Seed.BASE_FILENAME_REGEX_ = /_+[a-zA-Z]+/;


/**
 * Default error message to display when a table failed to be created.
 * @const
 * @type {string}
 * @private
 */
Seed.DEFAULT_CREATE_TABLE_ERROR_ = 'This table (%s) could not be created:\t%s';


/**
 * Default error message to display when a query failed to execute.
 * @const
 * @type {string}
 * @private
 */
Seed.DEFAULT_QUERY_ERROR_ = 'Could not perform query:\n%s\nError:\t%s';


/**
 * Regex to determine whether a SQL script is for setup or teardown.
 * @const
 * @type {RegExp}
 * @private
 */
Seed.SETUP_FILE_REGEX_ = /_setup/;
