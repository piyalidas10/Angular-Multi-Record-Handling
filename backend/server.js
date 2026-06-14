const express = require('express');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/*
|--------------------------------------------------------------------------
| Generate Large Dataset (Demo)
|--------------------------------------------------------------------------
*/

const customers = [];

for (let i = 1; i <= 100000; i++) {
  customers.push({
    id: i,
    name: `Customer ${i}`,
    email: `customer${i}@company.com`
  });
}

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP'
  });
});

/*
|--------------------------------------------------------------------------
| Customer Search API
|--------------------------------------------------------------------------
|
| Example:
| /customers?page=1&limit=20&search=100
|
*/

app.get('/customers', (req, res) => {

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = (req.query.search || '').toLowerCase();

  let filteredCustomers = customers;

  if (search) {

    filteredCustomers = customers.filter(customer =>
      customer.name.toLowerCase().includes(search) ||
      customer.email.toLowerCase().includes(search)
    );

  }

  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedData =
    filteredCustomers.slice(startIndex, endIndex);

  res.status(200).json({
    page,
    limit,
    totalRecords: filteredCustomers.length,
    totalPages: Math.ceil(
      filteredCustomers.length / limit
    ),
    data: paginatedData
  });

});

/*
|--------------------------------------------------------------------------
| Get Single Customer
|--------------------------------------------------------------------------
*/

app.get('/customers/:id', (req, res) => {

  const id = Number(req.params.id);

  const customer =
    customers.find(c => c.id === id);

  if (!customer) {

    return res.status(404).json({
      message: 'Customer not found'
    });

  }

  res.json(customer);

});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`
==================================
 Server Running
==================================
 URL : http://localhost:${PORT}
==================================
  `);
});