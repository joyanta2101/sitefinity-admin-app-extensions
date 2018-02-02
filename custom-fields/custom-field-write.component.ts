import { Component } from "@angular/core";
import { FieldBase } from "progress-sitefinity-adminapp-sdk/app/api/v1";

@Component({
    template: require("./custom-field-write.component.html"),
    styles: [
        `
            .custom-input {
                height: 100px;
                border: 2px solid green;
            }
        `
    ]
})
export class CustomInputWriteComponent extends FieldBase { }
