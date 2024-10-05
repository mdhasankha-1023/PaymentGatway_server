const express = require("express");
const SSLCommerzPayment = require('sslcommerz-lts')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173'
}));


const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const store_id = process.env.SSLCOMMERCE_STOREID;
const store_passwd = process.env.SSLCOMMERCE_STORE_PASSWORD;
const is_live = false;
// console.log(store_id, store_passwd)

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // collection
        const paymentHistoryCollection = client.db('brainWave').collection('paymentHistory');

        const trans_id = new ObjectId().toString();
        // post payment getaway 
        app.post('/paymentGateway/sslCommerce', async (req, res) => {
            const orderInfo = req.body;

            const data = {
                total_amount: orderInfo?.amount,
                currency: `${orderInfo?.currency}`,
                tran_id: `${trans_id}`, // use unique tran_id for each api call
                success_url: `http://localhost:5000/payment/success/${trans_id}`,
                fail_url: `http://localhost:5000/payment/failed/${trans_id}`,
                cancel_url: 'http://localhost:3030/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'Courier',
                product_name: `${orderInfo?.productName}`,
                product_category: `${orderInfo?.category}`,
                product_profile: 'general',
                cus_name: `${orderInfo.name}`,
                cus_email: `${orderInfo.email}`,
                cus_add1: `${orderInfo.address}`,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: `${orderInfo?.country}`,
                cus_phone: `${orderInfo.phone}`,
                cus_fax: '01711111111',
                ship_name: 'Customer Name',
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };
            // console.log(data);
            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL;
                // console.log(GatewayPageURL);
                res.send({ redirect_url: GatewayPageURL });
                const paymentInfo = {
                    orderInfo,
                    transactionId: trans_id,
                    date: new Date(),
                    payment_status: false, //first time payment status is false
                    currency: data?.currency,
                    acct_no: trans_id,
                    shipping_method: 'Online',
                }
                const result = paymentHistoryCollection.insertOne(paymentInfo);
                console.log(paymentInfo)
            });
            app.post('/payment/success/:trans_id', async (req, res) => {
                const result = await paymentHistoryCollection.updateOne({ transactionId: req.params.trans_id }, {
                    $set: {
                        payment_status: true // when redirect success page than update payment status
                    }
                })
                if (result.modifiedCount > 0) {
                    res.redirect(`http://localhost:5173/payment/success/${req.params.trans_id}`)
                }
            })
            app.post('/payment/failed/:trans_id', async (req, res) => {
                const result = await paymentHistoryCollection.deleteOne({ transactionId: req.params.trans_id })
                if (result.deletedCount) {
                    res.redirect(`http://localhost:5173/payment/failed/${req.params.trans_id}`)
                }
            })
        })

        app.get('/payment-history/:trans_id', async (req, res) => {
            const id = req.params.trans_id;
            console.log(id)
            const result = await paymentHistoryCollection.findOne({ transactionId: id });
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
run().catch(console.log);



app.get('/', (req, res) => {
    res.send(`This is payment getaway server...`)
})


app.listen(port, () => {
    console.log(`This server running on PORT: ${port}`)
})