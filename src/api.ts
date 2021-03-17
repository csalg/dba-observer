import express from 'express';

const api = express();
const port = 3000;
api.get('/', (req, res) => {
    res.send('There will be houses here one day...');
});
api.listen(port, () => {
    // if (err) {
    //     return console.error(err);
    // }
    return console.log(`server is listening on ${port}`);
});