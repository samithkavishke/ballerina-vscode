/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Dropdown, OptionProps } from "@wso2/ui-toolkit";
import React, { ChangeEvent, useMemo } from "react"
import { FormField } from "../../../Form/types";

interface EnumEditorProps {
    value: string;
    field: FormField;
    onChange: (value: string, cursorPosition: number) => void;
    items: OptionProps[];
}

const DEFAULT_NONE_SELECTED_VALUE = "__none__";

export const EnumEditor = (props: EnumEditorProps) => {
    const options = useMemo(
        () => (props.items.length > 0 ? props.items : (props.field.itemOptions ?? [])),
        [props.items, props.field.itemOptions]
    );

    // The member the parameter defaults to, which the placeholder holds as the value of that option. An
    // optional enum defaults to nil, which refers to no member, hence there is not always one.
    const defaultOption = useMemo(
        () => options.find(item => item.value === props.field.placeholder),
        [options, props.field.placeholder]
    );

    const isSetToAnOption = props.value !== undefined && props.value !== null && props.value !== ""
        && options.some(item => item.value === props.value);

    const itemsList = useMemo(() => {
        // Leaving the field empty applies the default of the parameter, so the member it applies stands for
        // the empty selection and gets no entry of its own: an entry repeating a member of the list reads as
        // a second way of selecting it. One is offered when there is no default to apply, and when the field
        // holds something that none of the members stands for, which needs a selection to fall back to.
        if (defaultOption && (isSetToAnOption || !props.value)) {
            return options;
        }
        return [
            ...options,
            {
                id: "default-option",
                content: "No Selection",
                value: DEFAULT_NONE_SELECTED_VALUE
            }
        ];
    }, [options, defaultOption, isSetToAnOption, props.value]);

    const selectedValue = useMemo(() => {
        if (isSetToAnOption) {
            return props.value;
        }
        // An empty field applies the default of the parameter, hence the member it applies is shown as the
        // selected one. A value that none of the members stands for (e.g. pro code written by hand) is not a
        // selection of any of them, and showing one would misreport what the source holds.
        if (!props.value && defaultOption) {
            return defaultOption.value;
        }
        return DEFAULT_NONE_SELECTED_VALUE;
    }, [props.value, isSetToAnOption, defaultOption]);

    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === DEFAULT_NONE_SELECTED_VALUE) {
            props.onChange("", 0);
        } else {
            props.onChange(value, value.length);
        }
    }


    return (
        <Dropdown
            id={props.field.key}
            aria-label={props.field.label}
            value={selectedValue.trim()}
            items={itemsList}
            onChange={handleChange}
            sx={{ width: "100%" }}
            containerSx={{ width: "100%" }}
        />
    )
}
