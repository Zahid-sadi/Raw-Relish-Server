const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken')
require("dotenv").config();

const port = process.env.PORT || 3000;

// middleware

app.use(cors());
app.use(express.json());


const verificationJWT = (req, res, next)=>{
    const authorization = req.headers.authorization;
    if(!authorization){
        return res.status(401).send({error: true , message: 'unauthorized-access'});

    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
        if(error){
            return res.status(401).send({
                error: true, 
                message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
    })

}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2hres75.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const itemsCollection = client.db("rawRelishDb").collection("items");
        const reviewsCollection = client.db("rawRelishDb").collection("reviews");
        const cartCollection = client.db("rawRelishDb").collection("cart");
        const usersCollection = client.db("rawRelishDb").collection("users");


        app.post('/jwt', (req, res)=>{
            const user = req.body;
            
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '120s'
            });
            res.send({token})
        })


        app.get('/users', async (req, res)=>{
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.post("/users", async (req , res)=>{
            const user = req.body;
            const query = { email: user.email}
            console.log(query);
            const existingId = await usersCollection.findOne(query)
            // console.log(existingId);
            if(existingId){
               return res.send({ message:'same user logged already'})
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })


        // update admin

        app.patch('/users/admin/:id', async (req, res)=>{
            const id = req.params.id;
            const filter =  { _id: new ObjectId(id)}
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)

        })


        

        app.get("/items", async (req, res) => {
            const result = await itemsCollection.find().toArray();
            res.send(result);
        });

        app.get("/review", async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            
            res.send(result);
        });



        app.get("/cart",  async (req, res) => {
            const email = req.query.email;
            console.log(email);

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if(email !== decodedEmail){
                return res.status(403).send({
                    error: true, 
                    message : 'forbidden access'})
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
           
        });

      

        app.post("/cart", async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });

        app.delete('/cart/:id', async (req, res)=>{
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })




       













        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("raw is running");
});

app.listen(port, () => {
    console.log(`raw is running on ${port}`);
});
