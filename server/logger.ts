export const logger = {
  logQuery: (query: string, params: any) => {
    console.log("Query:", query);
    if (params && params.length > 0) {
      console.log("Params:", params);
    }
  }
};