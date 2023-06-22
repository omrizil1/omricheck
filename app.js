const express = require('express');
const axios = require('axios');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const app = express();
const port = 8000;

let work = []
let workedComplete = []
const maxWorkers = 2
let currentWorkers = 0
AWS.config.update({ region: 'us-east-1' });
const ec2 = new AWS.EC2();
app.use(express.json());
app.get('/',(req, res) => res.status(200).json(parkingLots))

app.put('/enqueue', (req, res) => {
    const iterations = req.query.iterations;
    const buffer = req.body.buffer;
    const id = uuidv4();
    work.push({
        id,
        iterations,
        buffer,
        time : Date.now()
    })

    // Perform any necessary processing with the iterations and body data
    console.log('Iterations:', iterations);
    console.log('buffer:', buffer);

    // Send a response indicating successful processing
    res.send(id);
});


app.post('/pullCompleted', (req, res) => {
    const { top } = req.query;
    console.log('top:', top);

    return res.status(200).json("hi")

})

app.get('/giveWork', (req,res) => {
    let currentWork = work.shift()
    res.status(200).json(currentWork);
})

app.listen(port, () => console.log(`Express app running on port ${port}!`));

cron.schedule('*/30 * * * * *', async () => {
    // Check if the first element in the workers queue has been waiting for more than 20 seconds
    console.log("cron run")
    if (work.length > 0) {
        const firstWorker = work[0];
        const timeDifference = Date.now() - firstWorker.time;

        if (timeDifference > 20000 && currentWorkers < maxWorkers) { // 20 seconds = 20000 milliseconds
            // Create a new worker
            await createWorker();
            currentWorkers += 1;
        }
    }
});

// Function to create a new worker
async function createWorker() {
    // Create a new EC2 instance

    try {

        const userData = `#!/bin/bash
                          curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
                          sudo apt-get install -y nodejs
                          git clone https://github.com/omrizil1/omricheck.git /home/ubuntu/your-app
                          cd /home/ubuntu/your-app
                          npm install
                          touch logfile.log
                          nohup node app.js > ./logfile.log 2>&1 &`;

        const userDataBase64 = Buffer.from(userData).toString('base64');
        const keyPairName = "cloud-course";

        const params = {
            ImageId: 'ami-042e8287309f5df03', // Replace with the desired AMI ID
            InstanceType: 't3.micro',
            KeyName: keyPairName, // Replace with the name of your EC2 key pair
            MinCount: 1,
            MaxCount: 1,
            UserData: userDataBase64,
            IamInstanceProfile: {
                Name: 'InstanceRole'
            }
        };

        ec2.runInstances(params, (err, data) => {
            if (err) {
                console.log('Error creating worker:', err);
            } else {
                const instanceId = data.Instances[0].InstanceId;
                console.log('Worker instance created:', instanceId);

                // Wait until the instance is running and the app is accessible
                ec2.waitFor('instanceRunning', {InstanceIds: [instanceId]}, (err, data) => {
                    if (err) {
                        console.log('Error waiting for instance to run:', err);
                    } else {
                        console.log('Worker instance is running');

                        // Check if the app is running by making an HTTP request
                        const instancePublicIp = data.Reservations[0].Instances[0].PublicIpAddress;
                        const appUrl = `http://${instancePublicIp}:8000`; // Replace with the actual app URL

                        // axios.get(appUrl)
                        //     .then((response) => {
                        //         console.log('App is running');
                        //         // Perform any necessary actions with the running instance
                        //     })
                        //     .catch((error) => {
                        //         console.log('Error accessing app:', error);
                        //     });
                    }
                });
            }
        });
    } catch (error) {
        console.log("error",error)
    }
}
