package com.example.springbootwebapp.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
@Document
public class Contact {
	@Id
	private String id;
	private String name;
	private String email;

}
