# Nodejs Backend

## Test API

First Page
```
GET http://localhost:3000/customers?page=1&limit=20
```

Search
```
GET http://localhost:3000/customers?page=1&limit=20&search=500
```

Single Customer
```
GET http://localhost:3000/customers/500
```

Example Response
```
{
  "page": 1,
  "limit": 20,
  "totalRecords": 300,
  "totalPages": 15,
  "data": [
    {
      "id": 500,
      "name": "Customer 500",
      "email": "customer500@company.com"
    }
  ]
}
```