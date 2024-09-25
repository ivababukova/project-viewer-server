const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { buildHTTPExecutor } = require('@graphql-tools/executor-http');
const { schemaFromExecutor } = require('@graphql-tools/wrap');
const helmet = require('helmet');
const { fetch } = require('cross-fetch');
const { print } = require('graphql');
const cors = require('cors');

const REMOTE_API_URL = 'https://backboard.railway.app/graphql/v2'
const CLIENT_URL_PRODUCTION = 'https://railway-project-viewer-production.up.railway.app'
const CLIENT_URL_DEVELOPMENT = 'http://localhost:3000'

const allowedOrigins = [CLIENT_URL_DEVELOPMENT, CLIENT_URL_PRODUCTION]

async function createServer() {
  const app = express();

  // Use CORS middleware
  app.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy does not allow access from the specified Origin.'), false);
        }
      },
      credentials: true, // Enable if you need to send cookies or authorization headers
    })
  );

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
      console.log('Response from remote API:', responseData);

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
    context: ({ req }) => ({
      authorization: req.headers.authorization || '',
      variables: req.body.variables,
    }),
    introspection: true,
    playground: true,
    formatError: (error) => {
      console.error('Detailed error:', error.extensions);
      return error;
    },
  });

  // Start the Apollo Server
  await server.start();

  // Apply middleware to the Express app
  server.applyMiddleware({ app, path: '/graphql' });

  app.use(helmet());

  // Start the server
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
