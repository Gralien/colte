require('dotenv').config();
const test_request = require('supertest');
const common_models = require('colte-common-models');

// The app will be instantiated after database prep.
let app = null;
let db_specific_knex = null;

const databaseName = `colte_purchase_test_for_worker_${process.env.JEST_WORKER_ID}`;

beforeAll(async (done) => {
  // Setup knex to run seeds and migrations.
  let config = common_models.knexFile[process.env.NODE_ENV];
  config.migrations.directory = "../colte-common-models/" + config.migrations.directory;
  config.seeds.directory = "../colte-common-models/" + config.seeds.directory;
  const knex = common_models.getKnexInstance(config);

  await knex.raw(`DROP DATABASE IF EXISTS ${databaseName};`).then( () => {
    return knex.raw(`CREATE DATABASE ${databaseName};`);
  }).then(() => {
    process.env.DB_NAME = databaseName;
    app = require('../app');
  }).then(() => {
    // Update the config to point to the newly created database
    config.connection.database = databaseName;
    db_specific_knex = require('colte-common-models').getKnexInstance(config);
    return db_specific_knex.migrate.latest().then(() => {
      return db_specific_knex.seed.run();
    });
  }).then(() => {
    done();
  })
});

afterAll(async (done) => {
  db_specific_knex.raw(`DROP DATABASE IF EXISTS ${databaseName}`)
  .then(() => {
    done();
  });
});

describe ("purchase API", function() {
  it('Get main page valid address', async (done) => {
    const res = await test_request(app)
      .get("/purchase")
      .set('X-Forwarded-For', '192.168.151.2');
    expect(res.statusCode).toEqual(200);
    done();
  });
  it('Get main page invalid address', async (done) => {
    const res = await test_request(app)
      .get("/purchase")
      .set('X-Forwarded-For', '255.255.255.255');
    expect(res.statusCode).toEqual(403);
    done();
  });
  it('Post main page (invalid verb)', async (done) => {
    const res = await test_request(app)
      .post("/purchase")
      .set('X-Forwarded-For', '192.168.151.2')
      .send("fish");
    expect(res.statusCode).toEqual(405);
    done();
  });
  it('Get purchase api (invalid verb)', async (done) => {
    const res = await test_request(app)
      .get("/purchase/purchase")
      .set('X-Forwarded-For', '192.168.151.2');
    expect(res.statusCode).toEqual(405);
    done();
  });
  it('Post purchase api, invalid address', async (done) => {
    const res = await test_request(app)
      .post("/purchase/purchase")
      .send({"package":"10000000"})
      .set('X-Forwarded-For', '0.0.0.0');
    expect(res.statusCode).toEqual(403);
    done();
  });
  it('Post purchase api, invalid amount', async (done) => {
    const res = await test_request(app)
      .post("/purchase/purchase")
      .send("1337")
      .set('X-Forwarded-For', '192.168.151.2');
    expect(res.statusCode).toEqual(400);
    done();
  });
  it('Post purchase api', async (done) => {
    const res = await test_request(app)
      .post("/purchase/purchase")
      .send({"package":"10000000"})
      .set('X-Forwarded-For', '192.168.151.2');
    expect(res.statusCode).toEqual(302);
    done();
  });

});
