import { Form, Input, Modal } from "antd";
import { ButtonProps } from "antd/lib/button";
import { FormComponentProps } from "antd/lib/form";
import React, { FC } from "react";

import { Graph } from "./types";

interface Props extends FormComponentProps {
  data?: Node;
  title: string;
  loading: boolean;
  visible: boolean;
  onOk: (node: Node) => void;
  onCancel: (visible: boolean) => void;
}

export const GraphModal: FC<Props> = (props) => {
  const { data, title, visible, loading, onOk, onCancel, form } = props;
  const { getFieldDecorator, validateFields, resetFields } = form;
  const buttonProps: ButtonProps = { shape: "round" };

  const handleOk = (e: any) => {
    e.preventDefault();

    validateFields(async (err: any, values: any) => {
      if (!err) {
        await onOk(values);
        resetFields();
      }
    });
  };

  const handleCancel = () => {
    resetFields();
    onCancel(false);
  };

  return (
    <Modal
      centered
      title={title}
      onOk={handleOk}
      visible={visible}
      confirmLoading={loading}
      onCancel={handleCancel}
      okButtonProps={buttonProps}
      cancelButtonProps={buttonProps}
    >
      <Form onSubmit={handleOk}>
        <Form.Item label="Graph denomination">
          {/* {getFieldDecorator("denomination", {
            initialValue: data ? data.denomination : "",
            rules: [{ required: true, message: "Please input node denomination!" }],
          })(<Input placeholder="Graph denomination" />)} */}
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default Form.create<Props>()(GraphModal);
