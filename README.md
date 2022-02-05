<h2 align="center">Penguin.js </h2>

<p align="center">
 <img src="https://c.tenor.com/Z_Z9gYlFDc0AAAAC/hello-penguin.gif" alt="E Penguin Shop" style="margin: 0px 15%;text-align:center;width:200px;"/>
</p>
<p align="center">
<img src="https://img.shields.io/github/issues/samayun/penguin.js" alt="Issues">
<img src="https://img.shields.io/github/forks/samayun/penguin.js" alt="Forks">

<img src="https://img.shields.io/github/stars/samayun/penguin.js?color=%2312ff65&label=Stars&logo=Star&logoColor=green&style=flat" alt="Stars">
<img src="https://img.shields.io/github/license/samayun/penguin.js" alt="License">

<a href="https://twitter.com/intent/tweet?text=What a framework ! Wow !Check It =>  :&url=https://github.com/samayun/penguin.js"> 
<img src="https://img.shields.io/twitter/url?label=Follow@samayun&logoColor=%230f0&url=https%3A%2F%2Fgithub.com%2Fsamayun%2Fpenguin.js" alt="Tweet">
</a>
</p>




Architect an express.js application

<!-- ![NODE.JS](https://viitorcloud.com/blog/wp-content/uploads/2018/06/Node-JS-App-Development-for-Business-cover.jpg) -->

## Documentation

- [FFMPEG Converter using CLI](modules/media/README.md)

## Commands and Usage

```bash

# clone repository & navigate project

# Copy .env.example to .env
 cp .env.example .env

# make storage link
 mkdir public

# Build container image
 make build

# Run containers
 make run

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
 ➡️ Virtualization
</summary>

- Build Container by Docker : `make build` or `docker build . -t samayun/penguin`
- Run Container by Docker: `make run` or `docker run -p 5000:8080 -d samayun/penguin`

</details>
