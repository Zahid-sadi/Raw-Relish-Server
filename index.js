const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)

const port = process.env.PORT || 3000;

// middleware

app.use(cors());
app.use(express.json());

const verificationJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log(authorization);
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized-access" });
    }
    const token = authorization.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            // console.log('jwt error', error);
            return res.status(401).send({
                error: true,
                message: "unauthorized access",
            });
        }
        req.decoded = decoded;
        next();
    });
};

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
        const paymentCollection = client.db("rawRelishDb").collection("payment");

        app.post("/jwt", (req, res) => {
            const user = req.body;

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1 days",
            });
            res.send({ token });
        });

        const adminVerification = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            if (user?.role !== "admin") {
                return res.status(403).send({ error: true, message: "forbidden message " });
            }
            next();
        };

        app.get("/users", verificationJWT, adminVerification, async (req, res) => {
            const result = await usersCollection.find().toArray();
            // console.log('users',result);
            res.send(result);
        });

        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingId = await usersCollection.findOne(query);
            // console.log(existingId);
            if (existingId) {
                return res.send({ message: "same user logged already" });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // update admin

        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: "admin",
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // verify admin

        app.get("/users/admin/:email", verificationJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ admin: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === "admin" };
            res.send(result);
        });

        app.delete("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const docToDelete = await usersCollection.findOne(query);
            if (docToDelete) {
                const result = await usersCollection.deleteOne(query);
                // console.log(result);
               return  res.send(result)
            } else {
                console.log("Document not found.");
            }

           
        });

        app.get("/items", async (req, res) => {
            const result = await itemsCollection.find().toArray();
            res.send(result);
        });

        app.get("/items/:id", async (req, res) => {
            const id = req.params.id;
            const query1 = { _id: id };  /** only id use for existing api  */

            const query2 = {_id: new ObjectId (id)}  /** objectId use for new api data  */              
            console.log('items query id',query1);

            const result1 = await itemsCollection.findOne(query1);
            const result2 = await itemsCollection.findOne(query2);
            res.send({result1, result2});
        });

        app.post("/items/", async (req, res) => {
            const newItemAdd = req.body;
            const result = await itemsCollection.insertOne(newItemAdd);
            // console.log(result);
            res.send(result);
        });

        app.delete("/items/:id", verificationJWT, adminVerification, async (req, res) => {
            const id = req.params.id;
            // console.log('deleted id',id);
            const query1 = {_id: new ObjectId(id)}
            const query2 = { _id: id };
            const result1 = await itemsCollection.deleteOne(query1);
            const result2 = await itemsCollection.deleteOne(query2);
            // console.log('delete item',result);
            res.send({result1, result2});
        });

        app.patch("/items/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };   /** only id use for existing api  */

            const query2 = {_id: new ObjectId (id)}   /** objectId use for new api data  */
            const updateDoc = {
                $set: req.body,
            };
            const result = await itemsCollection.updateOne(query, updateDoc);
            const result2 = await itemsCollection.updateOne(query2, updateDoc);
            // console.log(result, 'updated item');
            res.send({result,result2});
        });

        app.get("/cart", verificationJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email);

            if (!email) {
                return res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({
                    error: true,
                    message: "forbidden access",
                });
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            // console.log(result);
            res.send(result);
        });

        app.post("/cart", async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });

        app.delete("/cart/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });

        app.get("/review", async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        });


        // Create a PaymentIntent with the order amount and currency

        app.post("/create-payment-intent", verificationJWT, async (req, res) => {
            const {price} = req.body ;
            const amount = parseInt(price * 1000)   
            if(price > 0)    {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd",
      
                    payment_method_types: ['card']
                  });
                
                  res.send({
                    clientSecret: paymentIntent.client_secret,
                  });
            }
       
          });
          


          app.post('/payment', verificationJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            console.log(payment);
            if (payment && payment.cartItems) {
                const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
                const deleteResult = await cartCollection.deleteMany(query)
          
                res.send({ insertResult, deleteResult });
                // Rest of your code using the query
              } else {
                // Handle the case where payment or cartItems is undefined
                console.error("Payment or cartItems is undefined.");
              }
      
           
          })
      
          
          app.get('/admin-statistics', verificationJWT, adminVerification, async (req, res) => {
            const users = await usersCollection.estimatedDocumentCount();
            const estimatedItems = await itemsCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();
            const payments = await paymentCollection.find().toArray();
            const revenue = payments.reduce((total, payment) => total + parseFloat(payment.price), 0);
      
             return res.send({
              revenue,
              users,
              estimatedItems,
              orders
            })
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
