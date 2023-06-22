const express = require('express');
const axios = require('axios');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const crypto = require('crypto');
const app = express();
const port = 8000;

AWS.config.update({ region: 'us-east-1' });
const ec2 = new AWS.EC2();
app.use(express.json());
let lastRun = Date.now()
let firstIp;
let secondIp;

app.listen(port, () => console.log(`Express app running on port ${port}!`));


function work(buffer, iterations) {
    let output = crypto.createHash('sha512').update(buffer).digest();
    for (let i = 0; i < iterations - 1; i++) {
        output = crypto.createHash('sha512').update(output).digest();
    }
    return output;
}

const getInstanceIpAddress = async (instanceName) => {
    const params = {
        Filters: [
            {
                Name: 'tag:Name',
                Values: [instanceName]
            }
        ]
    };

    try {
        const response = await ec2.describeInstances(params).promise();
        const instances = response.Reservations.flatMap(reservation => reservation.Instances);
        if (instances.length > 0) {
            return instances[0].PublicIpAddress || instances[0].PrivateIpAddress;
        } else {
            console.log(`No instances found with the name '${instanceName}'.`);
            return null;
        }
    } catch (error) {
        console.log('Error retrieving instance details:', error);
        return null;
    }
};

const instanceName1 = 'first';
getInstanceIpAddress(instanceName1)
    .then(ipAddress => {
        if (ipAddress) {
            console.log(`IP address of instance '${instanceName1}': ${ipAddress}`);
            firstIp = ipAddress
        }
    })
    .catch(error => {
        console.log('Error:', error);
    });

const instanceName2 = 'second';
getInstanceIpAddress(instanceName2)
    .then(ipAddress => {
        if (ipAddress) {
            console.log(`IP address of instance '${instanceName2}': ${ipAddress}`);
            secondIp = ipAddress
        }
    })
    .catch(error => {
        console.log('Error:', error);
    });

async function getWork() {
    let nodesIps = [secondIp, firstIp]
    if (Date.now() - lastRun > 100000) {
        //terminzte worker
    } else {
        for (let ip of nodesIps) {
            console.log("ip" ,ip)
            let workObject = await axios.get(`http://${ip}:8000/giveWork`);
            console.log("workObject", workObject.data)
        }
    }
}

cron.schedule('*/10 * * * * *',  () => {
    getWork().then(r => r)
})