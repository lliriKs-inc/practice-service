import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { AppError } from "../../middlewares/error.middleware";
import { DocumentEavService } from "./document-eav.service";
import { updateDocumentFieldSchema } from "./dto/update-document-field.dto";

function param(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value !== "string" || !value) {
    throw new AppError(
      "Invalid document parameters",
      400,
      "INVALID_DOCUMENT_PARAMETERS"
    );
  }

  return value;
}

export class DocumentAdminController {
  constructor(private readonly service = new DocumentEavService()) {}

  async updateField(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { value } = updateDocumentFieldSchema.parse(req.body);
      const result = await this.service.updateAdminField(
        param(req, "cohortId"),
        param(req, "applicationId"),
        param(req, "type"),
        param(req, "fieldKey"),
        value
      );

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}
