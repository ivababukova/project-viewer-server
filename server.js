const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { buildHTTPExecutor } = require('@graphql-tools/executor-http');
const { schemaFromExecutor } = require('@graphql-tools/wrap');
const helmet = require('helmet');

const path = require('path');

async function createServer() {
  const app = express();

  const remoteExecutor = buildHTTPExecutor({
    endpoint: 'https://backboard.railway.app/graphql/v2',
  })

  const runtimeExecutor = buildHTTPExecutor({
    endpoint: 'https://backboard.railway.app/graphql/v2',
    headers: (executorRequest) => {
      const { authorization } = executorRequest.context;
      return {
        authorization,
      };
    },
  });

  // Create Apollo Server instance
  const server = new ApolloServer({
    schema: await schemaFromExecutor(remoteExecutor),
    executor: runtimeExecutor,
    context: ({ req }) => ({
      authorization: req.headers.authorization || '',
    }),
    introspection: true, // Enable introspection for development/testing
    playground: true,    // Enable GraphQL playground
    plugins: [
      {
        requestDidStart(requestContext) {
          console.log("Request operation name: ", requestContext.request.http.headers);
          console.log('Request headers: ', requestContext.request.headers);
          console.log('Request variables: ', requestContext.request.variables);
          console.log('Request query: ', requestContext.request.query);
          return {
            didEncounterErrors(requestContext) {
              console.error('An error occurred:', requestContext.errors);
            },
          };
        },
      },
    ],
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
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Run the server
createServer().catch((error) => {
  console.error('Error starting the server:', error);
});
