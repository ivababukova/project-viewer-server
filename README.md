# Saving the provided README.md content for the server to a file.

This is the backend GraphQL server for the Railway Project Viewer application. It serves as a proxy to the Railway API, handling GraphQL requests and token-based authentication, where the token is set as an HttpOnly cookie.

## Running locally
Before starting the server, ensure that you have the following installed:
- **Node.js** (>= 14.x.x)
- **NPM** (>= 6.x.x)
  
1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/project-viewer-server.git
   cd project-viewer-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the server:**
   ```bash
   npm start
   ```

4. **Run the client**
  The client app that sends queries to the server is located here: https://github.com/ivababukova/railway-project-viewer
  Follow the instructions there to get it to run.
