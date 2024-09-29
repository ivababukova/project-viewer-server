const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { buildHTTPExecutor } = require('@graphql-tools/executor-http');
const { schemaFromExecutor } = require('@graphql-tools/wrap');
const helmet = require('helmet');
const { fetch } = require('cross-fetch');
const { print } = require('graphql');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');


const REMOTE_API_URL = 'https://backboard.railway.app/graphql/v2'
const CLIENT_URL_PRODUCTION = 'https://railway-project-viewer-production.up.railway.app'
const CLIENT_URL_DEVELOPMENT = 'http://localhost:3000'

const allowedOrigins = [CLIENT_URL_DEVELOPMENT, CLIENT_URL_PRODUCTION]


async function createServer() {
  const app = express();

  app.use(helmet());

  app.use(bodyParser.json());

  app.use(cookieParser());

  // Use CORS middleware
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy does not allow access from the specified Origin.'), false);
        }
      },
      credentials: true,
    })
  );

  app.post('/api/set-token', async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    try {
      const testQuery = `
        query {
          me {
            id
            username
          }
        }
      `;

      const response = await fetch(REMOTE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: testQuery }),
      });

      const responseData = await response.json();

      if (responseData.errors) {
        console.error('Token validation failed:', responseData.errors);
        return res.status(401).json({ error: 'Invalid token. Please try again.' });
      }

      // Set the token as an HttpOnly cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({ message: 'Token set successfully' });
    } catch (error) {
      console.error('Error validating token:', error);
      return res.status(500).json({ error: 'Server error during token validation' });
    }

  });

  const remoteExecutor = buildHTTPExecutor({
    endpoint: REMOTE_API_URL,
  })

  const customHttpExecutor = async (executorRequest) => {
    const { document, context } = executorRequest;
    const query = print(document);
    const variables = context.variables;

    try {
      const response = await fetch(REMOTE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': context.authorization,
        },
        body: JSON.stringify({ query, variables }),
      });

      const responseData = await response.json();

      if (responseData.errors) {
        console.error('Errors from remote API:', responseData.errors);
      }
      return responseData;
    } catch (error) {
      console.error('Error in HTTP executor:', error);
      throw error;
    }
  };

  const server = new ApolloServer({
    schema: await schemaFromExecutor(remoteExecutor),
    executor: async ({ document, context }) => {
      return customHttpExecutor({ document, context });
    },
    context: ({ req }) => {
      const token = req.cookies.authToken || '';
      return {
        authorization: token ? `Bearer ${token}` : '',
        variables: req.body.variables,
      };
    },
    introspection: true,
    playground: true,
    formatError: (error) => {
      console.error('Detailed error:', error.extensions);
      return error;
    },
  });

  await server.start();


  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: {
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy does not allow access from the specified Origin.'), false);
        }
      },
      credentials: true,
    },
  });

  const PORT = process.env.PORT || 4000;
  const DOMAIN = process.env.RAILWAY_PUBLIC_DOMAIN || `http://localhost:${PORT}`;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at ${DOMAIN}${server.graphqlPath}`);
  });
}

// Run the server
createServer().catch((error) => {
  console.error('Error starting the server:', error);
});
