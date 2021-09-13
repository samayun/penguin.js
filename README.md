# Penguin.js

Architect an express.js application

![NODE.JS](https://viitorcloud.com/blog/wp-content/uploads/2018/06/Node-JS-App-Development-for-Business-cover.jpg)

## Commands and Usage

```bash

# clone repository & navigate project

# Copy .env.example to .env
$ cp .env.example .env

# Build container image
$ make build

# Run containers
$ make run

```

### Check List

<details>
  <summary>
  ➡️ Architechture
  </summary>

- ✅ Modular way
- ✅ Monolithic - Layered Architechture (3 Tier, actually 2 tier implemented here)

</details>

<details>
  <summary>
  ➡️ Design Patterns
    </summary>

- [ ] MVC - Model View Controller
- [ ] Singleton Pattern- global sharable instance suppose one database in whole application
- [ ] Facade Pattern - multiple database connection with same functionality
- [x] Service Repository Pattern

</details>
<details>
<summary>
 ➡️ Languages/Framework/Library
</summary>

- Language: ↪️ [Node.js](https://nodejs.org/en) as JS server side runtime
- Framework: ↪️ [Express.js](https://expressjs.com) as web framework
- Database: ↪️ [MongoDB](https://www.mongodb.com) as NoSQL Database
- Documentation: ↪️ [Swagger](https://swagger.io)

</details>

<details>
<summary>
 ➡️ Containerize
</summary>

- Build Container by Docker : `make build` or `docker build . -t samayun/penguin`
- Run Container by Docker: `make run` or `docker run -p 5000:8080 -d samayun/penguin`

</details>
