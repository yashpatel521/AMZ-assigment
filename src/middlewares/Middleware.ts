import { Request, Response, NextFunction } from "express";

class MiddleWare {
  private Reset = "\x1b[0m";
  private Bright = "\x1b[1m";
  private Dim = "\x1b[2m";
  private Underscore = "\x1b[4m";
  private Blink = "\x1b[5m";
  private Reverse = "\x1b[7m";
  private Hidden = "\x1b[8m";
  private FgBlack = "\x1b[30m";
  private FgRed = "\x1b[31m";
  private FgGreen = "\x1b[32m";
  private FgYellow = "\x1b[33m";
  private FgBlue = "\x1b[34m";
  private FgMagenta = "\x1b[35m";
  private FgCyan = "\x1b[36m";
  private FgWhite = "\x1b[37m";
  private BgBlack = "\x1b[40m";
  private BgRed = "\x1b[41m";
  private BgGreen = "\x1b[42m";
  private BgYellow = "\x1b[43m";
  private BgBlue = "\x1b[44m";
  private BgMagenta = "\x1b[45m";
  private BgCyan = "\x1b[46m";
  private BgWhite = "\x1b[47m";

  private setColor(text: string | undefined | string[], color: string) {
    return text ? `${color}${text.toString()}${this.Reset}` : "";
  }

  public requestLogs = (req: Request, res: Response, next: NextFunction) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const startTime = new Date();
    let { method, path: url } = req;
    const { body, params, query } = req;
    const userAgent = req.get("user-agent") || "";
    let reqID = new Date().getTime().toString();
    const coloredMethod = this.setColor(method, this.FgGreen);
    const coloredReqID = this.setColor(reqID, this.Dim);
    const coloredIP = this.setColor(ip, this.Dim);
    const coloredURL = this.setColor(
      this.setColor(url, this.FgBlack),
      this.BgGreen
    );

    console.log(`REQUEST: ${coloredIP} ${coloredMethod} path: ${coloredURL}`);
    console.log("Origin:", req.get("origin"));
    console.log("BODY:", body);
    console.log("PARAMS:", params);
    console.log("QUERY:", query);

    res.on("close", () => {
      const { statusCode } = res;
      let coloredStatusCode: string;

      if (statusCode >= 200 && statusCode <= 299) {
        coloredStatusCode = this.setColor(statusCode.toString(), this.FgGreen);
      } else if (statusCode >= 300 && statusCode <= 399) {
        coloredStatusCode = this.setColor(statusCode.toString(), this.FgYellow);
      } else if (statusCode >= 400 && statusCode <= 499) {
        coloredStatusCode = this.setColor(statusCode.toString(), this.FgYellow);
      } else if (statusCode >= 500 && statusCode <= 599) {
        coloredStatusCode = this.setColor(statusCode.toString(), this.FgRed);
      } else {
        coloredStatusCode = statusCode.toString();
      }

      const contentLength = res.get("content-length") || "0";
      const timeInSec = this.setColor(
        ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(3),
        this.FgGreen
      );

      console.log(
        `\nRESPONSE: ${coloredMethod} ${coloredURL} \nStatus: ${coloredStatusCode} \nContent-Length: ${contentLength} - \nUser-Agent: ${userAgent} \nIP: ${coloredIP} \nTime: ${timeInSec} sec`
      );
      console.log("Response Data:");
      console.log(
        "______________________________________________________________________________________\n"
      );
    });

    next();
  };
}

export default new MiddleWare();
